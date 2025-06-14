import { DR } from '@aneuhold/core-ts-lib';
import { CommandUtilService } from '../services/CommandUtilService.js';
import { LocalPackageStoreService } from '../services/LocalPackageStoreService.js';
import { PackageManagerService } from '../services/PackageManagerService.js';

/**
 * Implements the 'local-npm unsubscribe [<package-name>]' command.
 */
export class UnsubscribeCommand {
  /**
   * Implements the 'local-npm unsubscribe [<package-name>]' command.
   *
   * @param packageName - Optional package name to unsubscribe from. If not provided, unsubscribes from all packages
   */
  static async execute(packageName?: string): Promise<void> {
    const currentProjectPath = process.cwd();

    if (packageName) {
      // Unsubscribe from specific package
      await this.unsubscribeFromSpecificPackage(
        packageName,
        currentProjectPath
      );
    } else {
      // Unsubscribe from all packages
      await this.unsubscribeFromAllPackages(currentProjectPath);
    }
  }

  /**
   * Unsubscribes from a specific package.
   *
   * @param packageName - Name of the package to unsubscribe from
   * @param currentProjectPath - Path to the current project
   */
  private static async unsubscribeFromSpecificPackage(
    packageName: string,
    currentProjectPath: string
  ): Promise<void> {
    const entry = await LocalPackageStoreService.getPackageEntry(packageName);
    if (!entry) {
      throw new Error(`Package '${packageName}' not found in local registry`);
    }

    const subscriber = entry.subscribers.find(
      (sub) => sub.subscriberPath === currentProjectPath
    );
    if (!subscriber) {
      throw new Error(`Subscriber data not found for ${packageName}`);
    }

    // Remove current project from subscribers list
    await LocalPackageStoreService.removeSubscriber(
      packageName,
      currentProjectPath
    );

    // Reset to original version
    await CommandUtilService.updatePackageJsonVersion(
      currentProjectPath,
      packageName,
      subscriber.originalSpecifier
    );

    try {
      await PackageManagerService.runInstall(currentProjectPath);
    } catch (error) {
      DR.logger.warn(
        `Install failed after unsubscribing from ${packageName}: ${String(error)}. The package.json has been reset successfully.`
      );
    }

    DR.logger.info(`Successfully unsubscribed from ${packageName}`);
  }

  /**
   * Unsubscribes from all packages.
   *
   * @param currentProjectPath - Path to the current project
   */
  private static async unsubscribeFromAllPackages(
    currentProjectPath: string
  ): Promise<void> {
    const subscribedPackages =
      await LocalPackageStoreService.getSubscribedPackages(currentProjectPath);

    if (subscribedPackages.length === 0) {
      DR.logger.info('No packages to unsubscribe from');
      return;
    }

    DR.logger.info(
      `Unsubscribing from ${subscribedPackages.length} package(s)`
    );

    // Perform unsubscribe operations in parallel
    const unsubscribePromises = subscribedPackages.map(async (pkgName) => {
      try {
        const entry = await LocalPackageStoreService.getPackageEntry(pkgName);
        if (entry) {
          // Find the subscriber to get their original specifier
          const subscriber = entry.subscribers.find(
            (sub) => sub.subscriberPath === currentProjectPath
          );
          if (!subscriber) {
            return {
              packageName: pkgName,
              success: false,
              error: 'Subscriber data not found'
            };
          }

          // Remove current project from subscribers list
          await LocalPackageStoreService.removeSubscriber(
            pkgName,
            currentProjectPath
          );

          // Reset to original version using subscriber's original specifier
          await CommandUtilService.updatePackageJsonVersion(
            currentProjectPath,
            pkgName,
            subscriber.originalSpecifier
          );

          return { packageName: pkgName, success: true };
        }
        return {
          packageName: pkgName,
          success: false,
          error: 'Entry not found'
        };
      } catch (error) {
        DR.logger.error(
          `Failed to unsubscribe from ${pkgName}: ${String(error)}`
        );
        return { packageName: pkgName, success: false, error };
      }
    });

    // Wait for all unsubscribe operations to complete
    const results = await Promise.allSettled(unsubscribePromises);
    const successCount = results.filter(
      (result) => result.status === 'fulfilled' && result.value.success
    ).length;

    DR.logger.info(
      `Parallel unsubscribe completed: ${successCount}/${subscribedPackages.length} successful`
    );

    // Run install once after all updates
    try {
      await PackageManagerService.runInstall(currentProjectPath);
    } catch (error) {
      DR.logger.warn(
        `Install failed after unsubscribing from all packages: ${String(error)}. The package.json files have been reset successfully.`
      );
    }

    DR.logger.info(`Successfully unsubscribed from all packages`);
  }
}
