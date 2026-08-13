import { DR } from '@aneuhold/core-ts-lib';
import type {
  LocalPackageStore,
  PackageEntry,
  PackageSubscriber
} from '../types/LocalPackageStore.js';
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
   * Publishes a package with a fresh timestamp version and updates all subscribers.
   *
   * The caller has to hold the `MutexService` lock from the read that produced
   * the store through this call returning. The entry written here replaces
   * whatever the store holds for the package path, and the subscribers updated
   * here have their `package.json` rewritten and a package manager run in them,
   * neither of which another command can be doing at the same time.
   *
   * @param store - The store the published entry is written into
   * @param packageName - Name of the package to publish
   * @param packagePath - Path of the package to publish
   * @param originalVersion - Original version from package.json
   * @param existingSubscribers - Existing subscribers to preserve (empty array for new packages)
   * @param additionalSubscriber - Optional additional subscriber to add
   * @param additionalPublishArgs - Additional arguments to pass to the npm publish command
   */
  static async publishAndUpdateSubscribers(
    store: LocalPackageStore,
    packageName: string,
    packagePath: string,
    originalVersion: string,
    existingSubscribers: PackageSubscriber[] = [],
    additionalSubscriber?: PackageSubscriber,
    additionalPublishArgs: string[] = []
  ): Promise<string> {
    // Generate fresh timestamp version
    const timestampVersion = LocalPackageVersionService.generateTimestampVersion(
      originalVersion,
      packagePath
    );

    try {
      DR.logger.info(`Publishing ${packageName}@${timestampVersion} to Verdaccio`);

      // Update package.json with timestamp version
      await PackageJsonService.updatePackageVersion(packagePath, packageName, timestampVersion);

      // Publish to Verdaccio registry
      await VerdaccioService.publishPackage(packagePath, additionalPublishArgs);

      // Create/update local store entry
      const entry: PackageEntry = {
        originalVersion,
        currentVersion: timestampVersion,
        subscribers: [...existingSubscribers],
        publishArgs: additionalPublishArgs.length > 0 ? [...additionalPublishArgs] : undefined
      };

      if (
        additionalSubscriber &&
        !entry.subscribers.some(
          (subscriber) => subscriber.subscriberPath === additionalSubscriber.subscriberPath
        )
      ) {
        entry.subscribers.push(additionalSubscriber);
      }

      // Persisted before the subscribers are touched, so an install that fails
      // partway still leaves the published version recorded
      LocalPackageStoreService.updatePackageEntry(store, packageName, packagePath, entry);
      await LocalPackageStoreService.writeStore(store);

      await LocalPackageSubscriberService.updateSubscribersToVersion(
        store,
        packageName,
        packagePath,
        entry.subscribers,
        timestampVersion
      );

      // This directory keeps one version in the registry, and the sweep is by
      // slug rather than by what the store named, so a version an interrupted
      // publish left behind goes with it
      await VerdaccioService.removeVersionsPublishedFrom(
        packageName,
        packagePath,
        timestampVersion
      );

      // Restore original version in package.json after publishing
      await PackageJsonService.updatePackageVersion(packagePath, packageName, originalVersion);

      DR.logger.info(`Successfully published ${packageName}@${timestampVersion}`);

      return timestampVersion;
    } catch (error) {
      // Ensure we restore the original version even if publishing fails
      try {
        await PackageJsonService.updatePackageVersion(packagePath, packageName, originalVersion);
      } catch (restoreError) {
        DR.logger.error(
          `Failed to restore original version after publish error: ${String(restoreError)}`
        );
      }

      DR.logger.error(`Failed to publish package: ${String(error)}`);
      throw error;
    }
  }
}
