import { DR } from '@aneuhold/core-ts-lib';
import {
  LocalPackageStoreService,
  timestampPattern,
  type PackageEntry,
  type PackageSubscriber
} from './LocalPackageStoreService.js';
import { PackageJsonService } from './PackageJsonService.js';
import { PackageManagerService } from './PackageManagerService/PackageManagerService.js';
import { VerdaccioService } from './VerdaccioService.js';

/**
 * Utility service containing shared methods used by command classes.
 */
export class CommandUtilService {
  /**
   * Generates a timestamp version by appending current timestamp to the original version.
   * If the version already contains a timestamp, it replaces the existing timestamp.
   *
   * @param originalVersion - The original version string (may already contain a timestamp)
   */
  static generateTimestampVersion(originalVersion: string): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.]/g, '')
      .slice(0, 17); // Include milliseconds (YYYYMMDDHHMMssSSS)

    if (timestampPattern.test(originalVersion)) {
      // Replace existing timestamp with new one
      return originalVersion.replace(timestampPattern, `-${timestamp}`);
    }

    // No existing timestamp, append new one
    return `${originalVersion}-${timestamp}`;
  }

  /**
   * Publishes a package with a fresh timestamp version and updates all subscribers.
   * This unified method is used by both publish and subscribe commands.
   *
   * @param packageName - Name of the package to publish
   * @param packageRootPath - Root path of the package to publish
   * @param originalVersion - Original version from package.json
   * @param existingSubscribers - Existing subscribers to preserve (empty array for new packages)
   * @param additionalSubscriber - Optional additional subscriber to add (used by subscribe command)
   * @param additionalPublishArgs - Additional arguments to pass to the npm publish command
   */
  static async publishAndUpdateSubscribers(
    packageName: string,
    packageRootPath: string,
    originalVersion: string,
    existingSubscribers: PackageSubscriber[] = [],
    additionalSubscriber?: PackageSubscriber,
    additionalPublishArgs: string[] = []
  ): Promise<string> {
    // Generate fresh timestamp version
    const timestampVersion = this.generateTimestampVersion(originalVersion);

    try {
      DR.logger.info(
        `Publishing ${packageName}@${timestampVersion} to Verdaccio`
      );

      // Update package.json with timestamp version
      await PackageJsonService.updatePackageVersion(
        packageRootPath,
        packageName,
        timestampVersion
      );

      // Publish to Verdaccio registry
      await VerdaccioService.publishPackage(
        packageRootPath,
        additionalPublishArgs
      );

      // Create/update local store entry
      const entry: PackageEntry = {
        originalVersion,
        currentVersion: timestampVersion,
        subscribers: [...existingSubscribers],
        packageRootPath,
        publishArgs:
          additionalPublishArgs.length > 0
            ? [...additionalPublishArgs]
            : undefined
      };

      // Add additional subscriber if provided (for subscribe command)
      if (
        additionalSubscriber &&
        !entry.subscribers.some(
          (subscriber) =>
            subscriber.subscriberPath === additionalSubscriber.subscriberPath
        )
      ) {
        entry.subscribers.push(additionalSubscriber);
      }

      await LocalPackageStoreService.updatePackageEntry(packageName, entry);

      // Update all subscribers in parallel
      if (entry.subscribers.length > 0) {
        DR.logger.info(`Updating ${entry.subscribers.length} subscriber(s)`);

        const updatePromises = entry.subscribers.map(async (subscriber) => {
          try {
            await PackageJsonService.updatePackageVersion(
              subscriber.subscriberPath,
              packageName,
              timestampVersion
            );
            await PackageManagerService.runInstallWithRegistry(
              subscriber.subscriberPath
            );
            return { success: true, subscriber };
          } catch (error) {
            DR.logger.error(
              `Failed to update subscriber ${subscriber.subscriberPath}: ${String(error)}`
            );
            return { success: false, subscriber, error };
          }
        });

        // Execute all updates in parallel
        const results = await Promise.allSettled(updatePromises);
        const successCount = results.filter(
          (result) => result.status === 'fulfilled' && result.value.success
        ).length;

        DR.logger.info(
          `Completed parallel subscriber updates: ${successCount}/${entry.subscribers.length} successful`
        );
      }

      // Restore original version in package.json after publishing
      await PackageJsonService.updatePackageVersion(
        packageRootPath,
        packageName,
        originalVersion
      );

      DR.logger.info(
        `Successfully published ${packageName}@${timestampVersion}`
      );

      return timestampVersion;
    } catch (error) {
      // Ensure we restore the original version even if publishing fails
      try {
        await PackageJsonService.updatePackageVersion(
          packageRootPath,
          packageName,
          originalVersion
        );
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
