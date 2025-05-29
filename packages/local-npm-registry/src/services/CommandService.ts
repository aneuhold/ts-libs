import { DR, type PackageJson } from '@aneuhold/core-ts-lib';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import {
  LocalPackageStoreService,
  type PackageEntry
} from './LocalPackageStoreService.js';
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

    // Generate timestamp version
    const timestampVersion = this.generateTimestampVersion(originalVersion);

    // Update package.json with timestamp version
    await this.updatePackageJsonVersion(
      process.cwd(),
      packageName,
      timestampVersion
    );

    // Publish to Verdaccio registry
    await VerdaccioService.publishPackage(process.cwd());

    // Update local store
    const entry: PackageEntry = {
      originalVersion,
      currentVersion: timestampVersion,
      subscribers: [],
      packageRootPath: process.cwd()
    };

    // Get existing entry to preserve subscribers
    const existingEntry =
      await LocalPackageStoreService.getPackageEntry(packageName);
    if (existingEntry) {
      entry.subscribers = existingEntry.subscribers;
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

    // Reset publisher's package.json back to original version
    await this.updatePackageJsonVersion(
      process.cwd(),
      packageName,
      originalVersion
    );

    DR.logger.info(`Successfully published ${packageName}@${timestampVersion}`);
    if (entry.subscribers.length === 0) {
      DR.logger.info('No subscribers to update');
    }

    // Need to update subscribers if there are any here.

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

    // Re-publish package to Verdaccio with stored timestamp version
    await this.republishPackageToVerdaccio(packageName, entry);

    // Add current project to subscribers list
    await LocalPackageStoreService.addSubscriber(
      packageName,
      currentProjectPath
    );

    // Get updated entry with all subscribers
    const updatedEntry =
      await LocalPackageStoreService.getPackageEntry(packageName);
    if (!updatedEntry) {
      throw new Error('Failed to retrieve updated package entry');
    }

    // Update all subscribers including the new one
    DR.logger.info(`Updating ${updatedEntry.subscribers.length} subscriber(s)`);

    for (const subscriberPath of updatedEntry.subscribers) {
      try {
        await this.updatePackageJsonVersion(
          subscriberPath,
          packageName,
          updatedEntry.currentVersion
        );
        await this.runInstallCommand(subscriberPath);
      } catch (error) {
        DR.logger.error(
          `Failed to update subscriber ${subscriberPath}: ${String(error)}`
        );
      }
    }

    await VerdaccioService.stop();

    DR.logger.info(
      `Successfully subscribed to ${packageName}@${updatedEntry.currentVersion}`
    );
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
   * Generates a timestamp version by appending current timestamp to the original version.
   *
   * @param originalVersion - The original version string
   */
  private static generateTimestampVersion(originalVersion: string): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.]/g, '')
      .slice(0, 14);
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
   * Republishes a package to Verdaccio with proper version handling.
   *
   * @param packageName - Name of the package to republish
   * @param entry - Package entry containing version and path information
   */
  private static async republishPackageToVerdaccio(
    packageName: string,
    entry: PackageEntry
  ): Promise<void> {
    try {
      DR.logger.info(
        `Republishing ${packageName}@${entry.currentVersion} to Verdaccio`
      );

      // Temporarily update the source package.json to the timestamp version
      await this.updatePackageJsonVersion(
        entry.packageRootPath,
        packageName,
        entry.currentVersion
      );

      // Publish to Verdaccio registry
      await VerdaccioService.publishPackage(entry.packageRootPath);

      // Restore the original version in the source package.json
      await this.updatePackageJsonVersion(
        entry.packageRootPath,
        packageName,
        entry.originalVersion
      );

      DR.logger.info(
        `Successfully republished ${packageName}@${entry.currentVersion}`
      );
    } catch (error) {
      // Ensure we restore the original version even if publishing fails
      try {
        await this.updatePackageJsonVersion(
          entry.packageRootPath,
          packageName,
          entry.originalVersion
        );
      } catch (restoreError) {
        DR.logger.error(
          `Failed to restore original version after publish error: ${String(restoreError)}`
        );
      }

      DR.logger.error(`Failed to republish package: ${String(error)}`);
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
      // Check if project uses pnpm or npm
      const hasPnpmLock = await fs.pathExists(
        path.join(projectPath, 'pnpm-lock.yaml')
      );
      const command = hasPnpmLock ? 'pnpm' : 'npm';

      DR.logger.info(`Running ${command} install in ${projectPath}`);
      await execa(command, ['install'], { cwd: projectPath });
      DR.logger.info(`${command} install completed in ${projectPath}`);
    } catch (error) {
      DR.logger.error(
        `Error running install in ${projectPath}: ${String(error)}`
      );
      throw error;
    }
  }
}
