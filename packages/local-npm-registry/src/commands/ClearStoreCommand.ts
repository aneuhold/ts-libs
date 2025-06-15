import { DR } from '@aneuhold/core-ts-lib';
import { LocalPackageStoreService } from '../services/LocalPackageStoreService.js';
import { PackageJsonService } from '../services/PackageJsonService.js';
import { PackageManagerService } from '../services/PackageManagerService.js';

/**
 * Implements the 'local-npm clear-store' command.
 */
export class ClearStoreCommand {
  /**
   * Implements the 'local-npm clear-store' command.
   * Unpublishes all packages and unsubscribes all subscribers.
   */
  static async execute(): Promise<void> {
    const store = await LocalPackageStoreService.getStore();
    const packageNames = Object.keys(store.packages);

    if (packageNames.length === 0) {
      DR.logger.info('No packages in local registry to clear');
      return;
    }

    DR.logger.info(
      `Clearing ${packageNames.length} package(s) from local registry`
    );

    // Collect all subscriber reset operations across all packages
    const resetOperations: Array<{
      subscriberPath: string;
      packageName: string;
      originalVersion: string;
    }> = [];

    // Collect all reset operations first
    for (const packageName of packageNames) {
      const entry = store.packages[packageName];
      if (!entry) {
        continue;
      }

      DR.logger.info(`Processing package: ${packageName}`);

      // Collect subscriber reset operations
      if (entry.subscribers.length > 0) {
        DR.logger.info(
          `  Adding ${entry.subscribers.length} subscriber reset operation(s)`
        );

        for (const subscriber of entry.subscribers) {
          resetOperations.push({
            subscriberPath: subscriber.subscriberPath,
            packageName,
            originalVersion: subscriber.originalSpecifier
          });
        }
      }
    }

    // Execute all reset operations in parallel
    if (resetOperations.length > 0) {
      DR.logger.info(
        `Executing ${resetOperations.length} subscriber reset operations in parallel`
      );

      const resetPromises = resetOperations.map(async (operation) => {
        try {
          await PackageJsonService.updatePackageVersion(
            operation.subscriberPath,
            operation.packageName,
            operation.originalVersion
          );
          await PackageManagerService.runInstall(operation.subscriberPath);
          DR.logger.info(
            `✓ Reset ${operation.packageName} in ${operation.subscriberPath}`
          );
          return { success: true, operation };
        } catch (error) {
          DR.logger.error(
            `✗ Failed to reset ${operation.packageName} in ${operation.subscriberPath}: ${String(error)}`
          );
          return { success: false, operation, error };
        }
      });

      const results = await Promise.allSettled(resetPromises);
      const successCount = results.filter(
        (result) => result.status === 'fulfilled' && result.value.success
      ).length;
      const errorCount = resetOperations.length - successCount;

      DR.logger.info(
        `Parallel reset completed: ${successCount}/${resetOperations.length} successful`
      );

      // Clear the entire store
      await LocalPackageStoreService.clearStore();

      if (errorCount > 0) {
        DR.logger.warn(
          `Cleared ${packageNames.length} package(s) with ${errorCount} subscriber reset error(s)`
        );
      } else {
        DR.logger.info(
          `Successfully cleared all ${packageNames.length} package(s) and reset all subscribers`
        );
      }
    } else {
      // No subscribers to reset, just clear the store
      await LocalPackageStoreService.clearStore();
      DR.logger.info(
        `Successfully cleared all ${packageNames.length} package(s)`
      );
    }
  }
}
