import { DR, type PackageJson } from '@aneuhold/core-ts-lib';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import {
  LocalPackageStoreService,
  type PackageEntry
} from './LocalPackageStoreService.js';
import { PackageManagerService } from './PackageManagerDetectionService.js';
import { VerdaccioService } from './VerdaccioService.js';

/**
 * Service that implements the main CLI commands for local-npm-registry.
 */
export class CommandService {
  /**
   * Implements the 'local-npm publish' command.
   */
  static async publish(): Promise<void> {
    const packageInfo = await this.getPackageInfo();
    if (!packageInfo) {
      throw new Error('No package.json found in current directory');
    }

    const { name: packageName, version: originalVersion } = packageInfo;

    // Start Verdaccio server
    await VerdaccioService.start();

    // Get existing entry to preserve subscribers
    const existingEntry =
      await LocalPackageStoreService.getPackageEntry(packageName);
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

    // Start Verdaccio server
    await VerdaccioService.start();

    // Publish package and update subscribers
    const freshVersion = await this.publishAndUpdateSubscribers(
      packageName,
      entry.packageRootPath,
      entry.originalVersion,
      entry.subscribers,
      currentProjectPath
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
      const packageInfo = await this.getPackageInfo();
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

      for (const subscriberPath of entry.subscribers) {
        try {
          await this.updatePackageJsonVersion(
            subscriberPath,
            targetPackageName,
            entry.originalVersion
          );
          await this.runInstallCommand(subscriberPath);
        } catch (error) {
          DR.logger.error(
            `Failed to reset subscriber ${subscriberPath}: ${String(error)}`
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

      if (!entry.subscribers.includes(currentProjectPath)) {
        throw new Error(`Current project is not subscribed to ${packageName}`);
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
        entry.originalVersion
      );
      await this.runInstallCommand(currentProjectPath);

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

      for (const pkgName of subscribedPackages) {
        try {
          const entry = await LocalPackageStoreService.getPackageEntry(pkgName);
          if (entry) {
            // Remove current project from subscribers list
            await LocalPackageStoreService.removeSubscriber(
              pkgName,
              currentProjectPath
            );

            // Reset to original version
            await this.updatePackageJsonVersion(
              currentProjectPath,
              pkgName,
              entry.originalVersion
            );
          }
        } catch (error) {
          DR.logger.error(
            `Failed to unsubscribe from ${pkgName}: ${String(error)}`
          );
        }
      }

      // Run install once after all updates
      await this.runInstallCommand(currentProjectPath);

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

    let successCount = 0;
    let errorCount = 0;

    // Reset all subscribers for all packages
    for (const packageName of packageNames) {
      const entry = store.packages[packageName];
      if (!entry) {
        continue;
      }

      DR.logger.info(`Processing package: ${packageName}`);

      // Reset all subscribers to original version
      if (entry.subscribers.length > 0) {
        DR.logger.info(
          `  Resetting ${entry.subscribers.length} subscriber(s) to original version`
        );

        for (const subscriberPath of entry.subscribers) {
          try {
            await this.updatePackageJsonVersion(
              subscriberPath,
              packageName,
              entry.originalVersion
            );
            await this.runInstallCommand(subscriberPath);
            DR.logger.info(`    ✓ Reset subscriber: ${subscriberPath}`);
          } catch (error) {
            DR.logger.error(
              `    ✗ Failed to reset subscriber ${subscriberPath}: ${String(error)}`
            );
            errorCount++;
          }
        }
      }

      successCount++;
    }

    // Clear the entire store
    await LocalPackageStoreService.clearStore();

    if (errorCount > 0) {
      DR.logger.warn(
        `Cleared ${successCount} package(s) with ${errorCount} subscriber reset error(s)`
      );
    } else {
      DR.logger.info(
        `Successfully cleared all ${successCount} package(s) and reset all subscribers`
      );
    }
  }

  /**
   * Generates a timestamp version by appending current timestamp to the original version.
   *
   * @param originalVersion - The original version string
   */
  private static generateTimestampVersion(originalVersion: string): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.]/g, '')
      .slice(0, 17); // Include milliseconds (YYYYMMDDHHMMssSSS)
    return `${originalVersion}-${timestamp}`;
  }

  /**
   * Reads the package.json file in the current directory.
   *
   * @param dir - Directory to search for package.json
   */
  private static async getPackageInfo(
    dir: string = process.cwd()
  ): Promise<{ name: string; version: string } | null> {
    try {
      const packageJsonPath = path.join(dir, 'package.json');
      const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;

      if (!packageJson.name || !packageJson.version) {
        throw new Error('package.json must contain name and version fields');
      }

      return {
        name: packageJson.name,
        version: packageJson.version
      };
    } catch (error) {
      DR.logger.error(`Error reading package.json: ${String(error)}`);
      return null;
    }
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
   * Runs install command in a project directory.
   *
   * @param projectPath - Path to the project directory
   */
  private static async runInstallCommand(projectPath: string): Promise<void> {
    try {
      // Detect the package manager based on lock files in the target project
      const packageManager =
        await PackageManagerService.detectPackageManager(projectPath);

      DR.logger.info(`Running ${packageManager} install in ${projectPath}`);
      await execa(packageManager, ['install'], { cwd: projectPath });
      DR.logger.info(`${packageManager} install completed in ${projectPath}`);
    } catch (error) {
      DR.logger.error(
        `Error running install in ${projectPath}: ${String(error)}`
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
    existingSubscribers: string[] = [],
    additionalSubscriber?: string
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

      // Update all subscribers
      if (entry.subscribers.length > 0) {
        DR.logger.info(`Updating ${entry.subscribers.length} subscriber(s)`);

        for (const subscriberPath of entry.subscribers) {
          try {
            await this.updatePackageJsonVersion(
              subscriberPath,
              packageName,
              timestampVersion
            );
            await this.runInstallCommand(subscriberPath);
          } catch (error) {
            DR.logger.error(
              `Failed to update subscriber ${subscriberPath}: ${String(error)}`
            );
          }
        }
      }

      // Restore original version in the source package.json
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
