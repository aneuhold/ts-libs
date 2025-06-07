import { DR, type PackageJson } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import path from 'path';
import {
  LocalPackageStoreService,
  timestampPattern,
  type PackageEntry,
  type PackageSubscriber
} from './LocalPackageStoreService.js';
import { PackageManagerService } from './PackageManagerService.js';
import { VerdaccioService } from './VerdaccioService.js';

/**
 * Service that implements the main CLI commands for local-npm-registry.
 */
export class CommandService {
  /**
   * Implements the 'local-npm publish' command.
   */
  static async publish(): Promise<void> {
    const packageInfo = await PackageManagerService.getPackageInfo();
    if (!packageInfo) {
      throw new Error('No package.json found in current directory');
    }

    const { name: packageName, version: currentPackageJsonVersion } =
      packageInfo;

    const existingEntry =
      await LocalPackageStoreService.getPackageEntry(packageName);

    // Prefer to use existing entry's original version if it exists. This helps
    // prevent a bug where the current package.json version has a timestamp.
    const originalVersion = existingEntry
      ? existingEntry.originalVersion
      : currentPackageJsonVersion;

    // Start Verdaccio server
    await VerdaccioService.start();

    const existingSubscribers = existingEntry?.subscribers || [];

    // Publish package and update subscribers
    await this.publishAndUpdateSubscribers(
      packageName,
      process.cwd(),
      originalVersion,
      existingSubscribers
    );

    if (existingSubscribers.length === 0) {
      DR.logger.info('No subscribers to update');
    }

    await VerdaccioService.stop();
  }

  /**
   * Implements the 'local-npm subscribe <package-name>' command.
   *
   * @param packageName - Name of the package to subscribe to
   */
  static async subscribe(packageName: string): Promise<void> {
    const entry = await LocalPackageStoreService.getPackageEntry(packageName);

    if (!entry) {
      const store = await LocalPackageStoreService.getStore();
      const availablePackages = Object.keys(store.packages);
      if (availablePackages.length > 0) {
        throw new Error(
          `Package '${packageName}' not found. Available packages: ${availablePackages.join(', ')}`
        );
      }
      throw new Error('No packages found in local registry');
    }

    const currentProjectPath = process.cwd();

    // Get the current specifier from package.json to save as original
    const originalSpecifier = await PackageManagerService.getCurrentSpecifier(
      currentProjectPath,
      packageName
    );
    if (!originalSpecifier) {
      throw new Error(
        `Package '${packageName}' not found in current project's dependencies. Please add it to package.json first.`
      );
    }

    // Start Verdaccio server
    await VerdaccioService.start();

    // Publish package and update subscribers
    const freshVersion = await this.publishAndUpdateSubscribers(
      packageName,
      entry.packageRootPath,
      entry.originalVersion,
      entry.subscribers,
      { subscriberPath: currentProjectPath, originalSpecifier }
    );

    await VerdaccioService.stop();

    DR.logger.info(`Successfully subscribed to ${packageName}@${freshVersion}`);
  }

  /**
   * Implements the 'local-npm unpublish <package-name>' command.
   *
   * @param packageName - Optional package name to unpublish. If not provided, uses current directory's package.json
   */
  static async unpublish(packageName?: string): Promise<void> {
    let targetPackageName: string;

    if (packageName) {
      targetPackageName = packageName;
    } else {
      const packageInfo = await PackageManagerService.getPackageInfo();
      if (!packageInfo) {
        throw new Error(
          'No package.json found in current directory and no package name provided'
        );
      }
      targetPackageName = packageInfo.name;
    }

    const entry =
      await LocalPackageStoreService.getPackageEntry(targetPackageName);
    if (!entry) {
      throw new Error(
        `Package '${targetPackageName}' not found in local registry`
      );
    }

    // Reset all subscribers to original version
    if (entry.subscribers.length > 0) {
      DR.logger.info(
        `Resetting ${entry.subscribers.length} subscriber(s) to original version`
      );

      for (const subscriber of entry.subscribers) {
        try {
          await this.updatePackageJsonVersion(
            subscriber.subscriberPath,
            targetPackageName,
            subscriber.originalSpecifier
          );
          await PackageManagerService.runInstall(subscriber.subscriberPath);
        } catch (error) {
          DR.logger.error(
            `Failed to reset subscriber ${subscriber.subscriberPath}: ${String(error)}`
          );
        }
      }
    }

    // Reset current package.json to original version if we're in the package directory
    if (!packageName) {
      await this.updatePackageJsonVersion(
        process.cwd(),
        targetPackageName,
        entry.originalVersion
      );
    }

    // Remove package from local store
    await LocalPackageStoreService.removePackage(targetPackageName);

    DR.logger.info(
      `Successfully unpublished ${targetPackageName} and reset all subscribers`
    );
  }

  /**
   * Implements the 'local-npm unsubscribe [<package-name>]' command.
   *
   * @param packageName - Optional package name to unsubscribe from. If not provided, unsubscribes from all packages
   */
  static async unsubscribe(packageName?: string): Promise<void> {
    const currentProjectPath = process.cwd();

    if (packageName) {
      // Unsubscribe from specific package
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
      await this.updatePackageJsonVersion(
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
    } else {
      // Unsubscribe from all packages
      const subscribedPackages =
        await LocalPackageStoreService.getSubscribedPackages(
          currentProjectPath
        );

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
            await this.updatePackageJsonVersion(
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

  /**
   * Implements the 'local-npm clear-store' command.
   * Unpublishes all packages and unsubscribes all subscribers.
   */
  static async clearStore(): Promise<void> {
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
          await this.updatePackageJsonVersion(
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

  /**
   * Generates a timestamp version by appending current timestamp to the original version.
   * If the version already contains a timestamp, it replaces the existing timestamp.
   *
   * @param originalVersion - The original version string (may already contain a timestamp)
   */
  private static generateTimestampVersion(originalVersion: string): string {
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
   * Updates a package.json file with a new version.
   *
   * @param projectPath - Path to the project directory containing package.json
   * @param packageName - Name of the package to update
   * @param version - New version to set
   */
  private static async updatePackageJsonVersion(
    projectPath: string,
    packageName: string,
    version: string
  ): Promise<void> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;

      // Update the package's own version if this is the package being published
      if (packageJson.name === packageName) {
        packageJson.version = version;
      }

      // Update dependencies
      if (packageJson.dependencies?.[packageName]) {
        packageJson.dependencies[packageName] = version;
      }

      // Update devDependencies
      if (packageJson.devDependencies?.[packageName]) {
        packageJson.devDependencies[packageName] = version;
      }

      // Update peerDependencies
      if (packageJson.peerDependencies?.[packageName]) {
        packageJson.peerDependencies[packageName] = version;
      }

      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      DR.logger.info(`Updated ${packageName} to ${version} in ${projectPath}`);
    } catch (error) {
      DR.logger.error(
        `Error updating package.json in ${projectPath}: ${String(error)}`
      );
      throw error;
    }
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
   */
  private static async publishAndUpdateSubscribers(
    packageName: string,
    packageRootPath: string,
    originalVersion: string,
    existingSubscribers: PackageSubscriber[] = [],
    additionalSubscriber?: PackageSubscriber
  ): Promise<string> {
    // Generate fresh timestamp version
    const timestampVersion = this.generateTimestampVersion(originalVersion);

    try {
      DR.logger.info(
        `Publishing ${packageName}@${timestampVersion} to Verdaccio`
      );

      // Update package.json with timestamp version
      await this.updatePackageJsonVersion(
        packageRootPath,
        packageName,
        timestampVersion
      );

      // Publish to Verdaccio registry
      await VerdaccioService.publishPackage(packageRootPath);

      // Create/update local store entry
      const entry: PackageEntry = {
        originalVersion,
        currentVersion: timestampVersion,
        subscribers: [...existingSubscribers],
        packageRootPath
      };

      // Add additional subscriber if provided (for subscribe command)
      if (
        additionalSubscriber &&
        !entry.subscribers.includes(additionalSubscriber)
      ) {
        entry.subscribers.push(additionalSubscriber);
      }

      await LocalPackageStoreService.updatePackageEntry(packageName, entry);

      // Update all subscribers in parallel
      if (entry.subscribers.length > 0) {
        DR.logger.info(`Updating ${entry.subscribers.length} subscriber(s)`);

        const updatePromises = entry.subscribers.map(async (subscriber) => {
          try {
            await this.updatePackageJsonVersion(
              subscriber.subscriberPath,
              packageName,
              timestampVersion
            );
            await PackageManagerService.runInstallWithRegistry(
              subscriber.subscriberPath
            );
            DR.logger.info(
              `Successfully updated subscriber: ${subscriber.subscriberPath}`
            );
            return { subscriberPath: subscriber.subscriberPath, success: true };
          } catch (error) {
            DR.logger.error(
              `Failed to update subscriber ${subscriber.subscriberPath}: ${String(error)}`
            );
            return {
              subscriberPath: subscriber.subscriberPath,
              success: false,
              error
            };
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
      await this.updatePackageJsonVersion(
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
        await this.updatePackageJsonVersion(
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
