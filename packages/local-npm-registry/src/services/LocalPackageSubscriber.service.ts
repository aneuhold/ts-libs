import { DR } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import type {
  LocalPackageStore,
  PackageSubscriber,
  PackageSubscription,
  PublishedPackage,
  PublishedPackageAndVersion
} from '../types/LocalPackageStore.js';
import { LocalPackageStoreService } from './LocalPackageStore.service.js';
import { PackageJsonService } from './PackageJson.service.js';
import { PackageManagerService } from './PackageManagerService/PackageManager.service.js';
import { VerdaccioService } from './Verdaccio.service.js';

/**
 * The version each project has to declare for a package, keyed by the
 * {@link PackageSubscriber.subscriberPath} of the project and then by the name
 * of the package.
 *
 * ```json
 * {
 *   "/home/someone/dev/some-project": {
 *     "@some-org/some-package": "1.2.3-pa1b2c3d4.20250528123456789",
 *     "@some-org/another-package": "^2.0.0"
 *   },
 *   "/home/someone/dev/another-project": {
 *     "@some-org/some-package": "1.2.3-pa1b2c3d4.20250528123456789"
 *   }
 * }
 * ```
 */
type VersionsBySubscriberPath = Map<string, Map<string, string>>;

/**
 * Service for the projects that subscribe to a locally published package.
 */
export class LocalPackageSubscriberService {
  /**
   * Points every {@link PackageSubscriber} of a set of published packages at
   * the version its package was published under, and installs each subscribing
   * project once however many of those packages it subscribes to.
   *
   * @param store - The store the published versions are read from and the dropped subscribers are removed from
   * @param publishedPackages - The packages a publish covered
   */
  static async updateSubscribersToPublishedVersions(
    store: LocalPackageStore,
    publishedPackages: PublishedPackage[]
  ): Promise<void> {
    // The version each subscription's package was published under is what that
    // subscriber declares for it
    const subscriptions: Array<PackageSubscription & PublishedPackageAndVersion> =
      publishedPackages.flatMap(({ packageName, packagePath }) => {
        const entry = LocalPackageStoreService.getPackageEntry(store, packageName, packagePath);
        if (!entry) {
          return [];
        }
        return entry.subscribers.map((subscriber) => ({
          ...subscriber,
          packageName,
          packagePath,
          publishedVersion: entry.currentVersion
        }));
      });

    const liveSubscriptions = await this.#dropSubscriptionsWithMissingDirectories(
      store,
      subscriptions
    );

    if (liveSubscriptions.length === 0) {
      return;
    }

    const versionsBySubscriberPath = this.#collectVersionsBySubscriberPath(
      liveSubscriptions,
      ({ publishedVersion }) => publishedVersion
    );

    DR.logger.info(`Updating ${versionsBySubscriberPath.size} subscriber(s)`);

    await this.#updateSubscriberVersionsAndInstall(store, versionsBySubscriberPath);
  }

  /**
   * Takes each {@link PackageSubscription} out of the store, rewrites the
   * subscriber's dependency back to the
   * {@link PackageSubscriber.originalSpecifier} it held, and reinstalls it.
   *
   * Verdaccio runs for this call.
   *
   * @param store - The store the subscriptions are removed from
   * @param subscriptions - The subscriptions being undone
   */
  static async resetPackageSubscriptions(
    store: LocalPackageStore,
    subscriptions: PackageSubscription[]
  ): Promise<void> {
    // Remove the subscribers from the store
    for (const { packageName, packagePath, subscriberPath } of subscriptions) {
      LocalPackageStoreService.removeSubscriber(store, packageName, packagePath, subscriberPath);
    }
    await LocalPackageStoreService.writeStore(store);

    const liveSubscriptions = await this.#dropSubscriptionsWithMissingDirectories(
      store,
      subscriptions
    );

    if (liveSubscriptions.length === 0) {
      return;
    }

    const versionsBySubscriberPath = this.#collectVersionsBySubscriberPath(
      liveSubscriptions,
      ({ originalSpecifier }) => originalSpecifier
    );

    await VerdaccioService.start();
    try {
      await this.#updateSubscriberVersionsAndInstall(store, versionsBySubscriberPath);
    } finally {
      await VerdaccioService.stop();
    }
  }

  /**
   * How many {@link PackageSubscriber.subscriberPath}s a set of
   * {@link PackageSubscription}s resets, which is what a command reports rather
   * than the number of subscriptions.
   *
   * @param subscriptions - The subscriptions being undone
   */
  static countSubscribers(subscriptions: PackageSubscription[]): number {
    return this.#getSubscriberPaths(subscriptions).length;
  }

  /**
   * Writes the version each project has to declare and installs each of them
   * once, whichever direction the versions came from.
   *
   * A project still holding subscriptions installs through the local registry,
   * since that is the only place the versions it is pinned to resolve, and a
   * project holding none installs the way it normally would.
   *
   * @param store - The store the projects' remaining subscriptions are read from
   * @param versionsBySubscriberPath - The version each project has to declare for each package
   */
  static async #updateSubscriberVersionsAndInstall(
    store: LocalPackageStore,
    versionsBySubscriberPath: VersionsBySubscriberPath
  ): Promise<void> {
    const subscriberPaths = [...versionsBySubscriberPath.keys()];

    const results = await Promise.allSettled(
      subscriberPaths.map(async (subscriberPath) => {
        const versionsByPackageName =
          versionsBySubscriberPath.get(subscriberPath) ?? new Map<string, string>();

        await PackageJsonService.updateDependencySpecifiers(subscriberPath, versionsByPackageName);

        if (
          LocalPackageStoreService.getSubscriptionsForSubscriber(store, subscriberPath).length > 0
        ) {
          await PackageManagerService.runInstallWithRegistry(subscriberPath, store);
        } else {
          await PackageManagerService.runInstall(subscriberPath);
        }

        DR.logger.info(`Updated ${versionsByPackageName.size} package(s) in ${subscriberPath}`);
      })
    );

    const failures = results.flatMap((result, index) =>
      result.status === 'rejected' ? [`  ${subscriberPaths[index]}: ${String(result.reason)}`] : []
    );

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} of ${subscriberPaths.length} subscriber(s) could not be updated:\n${failures.join('\n')}`
      );
    }
  }

  /**
   * Collects the version each project has to declare for each package it
   * subscribes to, which is one install's worth of work per project.
   *
   * @param subscriptions - The subscriptions the versions are taken from
   * @param getVersion - The version one subscription resolves to
   */
  static #collectVersionsBySubscriberPath<TSubscription extends PackageSubscription>(
    subscriptions: TSubscription[],
    getVersion: (subscription: TSubscription) => string
  ): VersionsBySubscriberPath {
    const versionsBySubscriberPath: VersionsBySubscriberPath = new Map();

    for (const subscription of subscriptions) {
      const { subscriberPath, packageName } = subscription;
      const versionsByPackageName =
        versionsBySubscriberPath.get(subscriberPath) ?? new Map<string, string>();

      versionsByPackageName.set(packageName, getVersion(subscription));
      versionsBySubscriberPath.set(subscriberPath, versionsByPackageName);
    }

    return versionsBySubscriberPath;
  }

  /**
   * The distinct {@link PackageSubscriber.subscriberPath}s a set of subscribers
   * covers, which is what a project is counted and installed in once by however
   * many packages it subscribes to.
   *
   * @param subscribers - The subscribers to take the paths of
   */
  static #getSubscriberPaths(subscribers: PackageSubscriber[]): string[] {
    return [...new Set(subscribers.map(({ subscriberPath }) => subscriberPath))];
  }

  /**
   * Removes the subscribers whose project directory is gone from the store,
   * returning the subscriptions that are left.
   *
   * A directory is checked once however many subscriptions it holds.
   *
   * @param store - The store the subscribers are removed from
   * @param subscriptions - The subscriptions to check the directories of
   */
  static async #dropSubscriptionsWithMissingDirectories<TSubscription extends PackageSubscription>(
    store: LocalPackageStore,
    subscriptions: TSubscription[]
  ): Promise<TSubscription[]> {
    const subscriberPaths = this.#getSubscriberPaths(subscriptions);
    const directoryChecks = await Promise.all(
      subscriberPaths.map(async (subscriberPath) => ({
        subscriberPath,
        directoryExists: await fs.pathExists(subscriberPath)
      }))
    );

    const missingPaths = new Set(
      directoryChecks
        .filter(({ directoryExists }) => !directoryExists)
        .map(({ subscriberPath }) => subscriberPath)
    );

    if (missingPaths.size === 0) {
      return subscriptions;
    }

    for (const subscriberPath of missingPaths) {
      DR.logger.warn(`Dropping subscriber ${subscriberPath}, whose directory no longer exists`);
    }
    for (const { packageName, packagePath, subscriberPath } of subscriptions) {
      if (missingPaths.has(subscriberPath)) {
        LocalPackageStoreService.removeSubscriber(store, packageName, packagePath, subscriberPath);
      }
    }
    await LocalPackageStoreService.writeStore(store);

    return subscriptions.filter(({ subscriberPath }) => !missingPaths.has(subscriberPath));
  }
}
