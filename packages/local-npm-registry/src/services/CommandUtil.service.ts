import { DR } from '@aneuhold/core-ts-lib';
import type {
  LocalPackageStore,
  PackageEntry,
  PackageSubscriber
} from '../types/LocalPackageStore.js';
import { LocalPackageStoreService } from './LocalPackageStore.service.js';
import { PackageJsonService } from './PackageJson.service.js';
import { PackageManagerService } from './PackageManagerService/PackageManager.service.js';
import { VerdaccioService } from './Verdaccio.service.js';

/**
 * Utility service containing shared methods used by command classes.
 */
export class CommandUtilService {
  /**
   * Publishes a package with a fresh timestamp version and updates all subscribers.
   * This unified method is used by both publish and subscribe commands.
   *
   * The caller has to hold `MutexLockName.Store` across the read that produced
   * the store and this call, since the entry written here replaces whatever the
   * store holds for the package path.
   *
   * @param store - The store the published entry is written into
   * @param packageName - Name of the package to publish
   * @param packagePath - Path of the package to publish
   * @param originalVersion - Original version from package.json
   * @param existingSubscribers - Existing subscribers to preserve (empty array for new packages)
   * @param additionalSubscriber - Optional additional subscriber to add (used by subscribe command)
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
    const timestampVersion = LocalPackageStoreService.generateTimestampVersion(
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

      // Add additional subscriber if provided (for subscribe command)
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

      // Update all subscribers in parallel. Every subscriber is attempted before
      // any failure is reported, so one broken consumer cannot hide the rest
      if (entry.subscribers.length > 0) {
        DR.logger.info(`Updating ${entry.subscribers.length} subscriber(s)`);

        const results = await Promise.allSettled(
          entry.subscribers.map(async ({ subscriberPath }) => {
            await PackageJsonService.updatePackageVersion(
              subscriberPath,
              packageName,
              timestampVersion
            );
            await PackageManagerService.runInstallWithRegistry(subscriberPath, store);
          })
        );

        const failures = results.flatMap((result, index) =>
          result.status === 'rejected'
            ? [`  ${entry.subscribers[index].subscriberPath}: ${String(result.reason)}`]
            : []
        );

        if (failures.length > 0) {
          throw new Error(
            `Published ${packageName}@${timestampVersion}, but ${failures.length} of ${entry.subscribers.length} subscriber(s) could not be updated:\n${failures.join('\n')}`
          );
        }
      }

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
