import { DR } from '@aneuhold/core-ts-lib';
import type {
  PackageToPublish,
  PinnedPublishedPackageJson,
  PublishedPackageAndVersion
} from '../types/LocalPackageOperations.js';
import type {
  LocalPackageStore,
  PackageEntry,
  PackageSubscriber,
  PublishedPackage
} from '../types/LocalPackageStore.js';
import { LocalPackageGraphService } from './LocalPackageGraph.service.js';
import { LocalPackageStoreService } from './LocalPackageStore.service.js';
import { LocalPackageSubscriberService } from './LocalPackageSubscriber.service.js';
import { LocalPackageVersionService } from './LocalPackageVersion.service.js';
import { PackageJsonService } from './PackageJson.service.js';
import { VerdaccioService } from './Verdaccio.service.js';

/**
 * Service for the directories that publish a package to the local registry,
 * which owns the version each one publishes under and the
 * {@link PackageEntry} that records it.
 */
export class LocalPackagePublisherService {
  /**
   * Publishes a package along with every locally published package that
   * depends on it, then points every subscriber of all of them at what was
   * published.
   *
   * The caller has to hold the `MutexService` lock from the read that produced
   * the store through this call returning. The entries written here replace
   * whatever the store holds for those package paths, and the subscribers
   * updated here have their `package.json` rewritten and a package manager run
   * in them, neither of which another command can be doing at the same time.
   *
   * @param store - The store the published entries are written into
   * @param rootPackage - The package the publish runs for, which is published first
   * @param originalVersion - The version the root package publishes from, which its store entry is recorded with
   * @param options - What this publish takes beyond the package it runs for
   * @param options.additionalSubscriber - A subscriber to record against the package the publish runs for
   * @param options.additionalPublishArgs - Arguments to pass to the npm publish command of the package the publish runs for
   */
  static async publishWithDependentsAndUpdateSubscribers(
    store: LocalPackageStore,
    rootPackage: PublishedPackage,
    originalVersion: string,
    options: {
      additionalSubscriber?: PackageSubscriber;
      additionalPublishArgs?: string[];
    } = {}
  ): Promise<string> {
    const { additionalSubscriber, additionalPublishArgs = [] } = options;
    const publishOrder = await LocalPackageGraphService.getPublishOrderStartingFrom(
      store,
      rootPackage
    );
    const pinnedPackageJsons: PinnedPublishedPackageJson[] = [];
    const publishedVersions: PublishedPackageAndVersion[] = [];

    try {
      for (const packageToPublish of publishOrder) {
        const { packageName, packagePath } = packageToPublish;
        const isRootPackage =
          packageName === rootPackage.packageName && packagePath === rootPackage.packagePath;
        const entry = LocalPackageStoreService.getPackageEntry(store, packageName, packagePath);

        // Every package but the one the publish runs for publishes under what
        // its own entry recorded
        const packageOriginalVersion = isRootPackage ? originalVersion : entry?.originalVersion;
        if (packageOriginalVersion === undefined) {
          throw new Error(
            `${packageName} in ${packagePath} has no entry in the local registry, so there is no version to publish it from`
          );
        }
        const publishArgs = isRootPackage ? additionalPublishArgs : (entry?.publishArgs ?? []);
        const timestampVersion = LocalPackageVersionService.generateTimestampVersion(
          packageOriginalVersion,
          packagePath
        );

        DR.logger.info(`Publishing ${packageName}@${timestampVersion} to Verdaccio`);

        // Read and recorded before anything is written, so a failure between
        // the two writes below still has a file to put back
        const { pins, pinnedPackageJson } = await this.#resolvePins(
          store,
          packageToPublish,
          packageOriginalVersion
        );
        pinnedPackageJsons.push(pinnedPackageJson);

        // Written before the tarball is packed, since `npm publish` packs the
        // package.json as it sits on disk
        await PackageJsonService.updateVersionField(packagePath, timestampVersion);
        await PackageJsonService.updateDependencySpecifiers(packagePath, pins);

        await VerdaccioService.publishPackage(packagePath, publishArgs);

        await this.#restorePackageJson(pinnedPackageJson);

        const newEntry: PackageEntry = {
          originalVersion: packageOriginalVersion,
          currentVersion: timestampVersion,
          subscribers: [...(entry?.subscribers ?? [])],
          publishArgs: publishArgs.length > 0 ? [...publishArgs] : undefined
        };

        if (
          isRootPackage &&
          additionalSubscriber &&
          !newEntry.subscribers.some(
            (subscriber) => subscriber.subscriberPath === additionalSubscriber.subscriberPath
          )
        ) {
          newEntry.subscribers.push(additionalSubscriber);
        }

        // Persisted before the subscribers are touched, so an install that
        // fails partway still leaves the published version recorded
        LocalPackageStoreService.updatePackageEntry(store, packageName, packagePath, newEntry);
        await LocalPackageStoreService.writeStore(store);

        publishedVersions.push({ packageName, packagePath, publishedVersion: timestampVersion });

        DR.logger.info(`Successfully published ${packageName}@${timestampVersion}`);
      }
    } catch (error) {
      await this.#restoreEveryPackageJson(pinnedPackageJsons);

      DR.logger.error(`Failed to publish package: ${String(error)}`);
      throw error;
    }

    await LocalPackageSubscriberService.updateSubscribersToPublishedVersions(
      store,
      publishedVersions
    );

    // Each directory keeps one version in the registry, and the sweep is by
    // slug rather than by what the store named, so a version an interrupted
    // publish left behind goes with it. It waits for the installs, since a
    // consumer still resolving an older version of one package of the publish
    // would otherwise have it taken mid-install
    for (const { packageName, packagePath, publishedVersion } of publishedVersions) {
      await VerdaccioService.removeVersionsPublishedFrom(
        packageName,
        packagePath,
        publishedVersion
      );
    }

    return publishedVersions[0].publishedVersion;
  }

  /**
   * Resolves the exact pin a package needs for every locally published package
   * it depends on, along with what its package.json is put back to once its
   * tarball is packed.
   *
   * A dependency left at the range the repository committed resolves through
   * the registry's uplink to the real published package, so what the pin keeps
   * out of the tarball is a second copy of a package the consumer already has.
   *
   * @param store - The store the pinned versions are read from
   * @param packageToPublish - The package being published
   * @param versionToRestore - The version its package.json is put back to
   */
  static async #resolvePins(
    store: LocalPackageStore,
    packageToPublish: PackageToPublish,
    versionToRestore: string
  ): Promise<{ pins: Map<string, string>; pinnedPackageJson: PinnedPublishedPackageJson }> {
    const { packagePath, dependencies } = packageToPublish;
    const pins = new Map<string, string>();
    const specifiersToRestore = new Map<string, string>();

    for (const dependency of dependencies) {
      const { packageName: dependencyName } = dependency;
      const dependencyEntry = LocalPackageStoreService.getPackageEntry(
        store,
        dependencyName,
        dependency.packagePath
      );
      const currentSpecifier = await PackageJsonService.getCurrentPackageVersionSpecifier(
        packagePath,
        dependencyName
      );

      // A dependency already sitting at what the registry holds needs neither
      // a pin nor a restore
      if (!dependencyEntry || currentSpecifier === null) {
        continue;
      }
      if (currentSpecifier === dependencyEntry.currentVersion) {
        continue;
      }

      pins.set(dependencyName, dependencyEntry.currentVersion);
      specifiersToRestore.set(dependencyName, currentSpecifier);
    }

    return {
      pins,
      pinnedPackageJson: {
        packagePath,
        versionField: versionToRestore,
        dependencySpecifiers: specifiersToRestore
      }
    };
  }

  /**
   * Puts one directory's package.json back to what it held before the publish
   * pinned it.
   *
   * @param pinnedPackageJson - What the file held before it was pinned
   */
  static async #restorePackageJson(pinnedPackageJson: PinnedPublishedPackageJson): Promise<void> {
    const { packagePath, versionField, dependencySpecifiers } = pinnedPackageJson;

    await PackageJsonService.updateVersionField(packagePath, versionField);
    await PackageJsonService.updateDependencySpecifiers(packagePath, dependencySpecifiers);
  }

  /**
   * Puts every directory a publish already wrote to back to what it held,
   * which is what keeps a publish that failed partway from leaving a pin
   * behind.
   *
   * A directory that cannot be restored is logged rather than thrown, since
   * the failure that got here is the one worth reporting.
   *
   * @param pinnedPackageJsons - What each directory held before it was pinned
   */
  static async #restoreEveryPackageJson(
    pinnedPackageJsons: PinnedPublishedPackageJson[]
  ): Promise<void> {
    for (const pinnedPackageJson of pinnedPackageJsons) {
      try {
        await this.#restorePackageJson(pinnedPackageJson);
      } catch (restoreError) {
        DR.logger.error(
          `Failed to restore ${pinnedPackageJson.packagePath} after a publish error: ${String(restoreError)}`
        );
      }
    }
  }
}
