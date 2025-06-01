import { DR, PackageJson } from '@aneuhold/core-ts-lib';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { ConfigService } from './ConfigService.js';
import { LocalPackageStoreService } from './LocalPackageStoreService.js';
import {
  PackageManagerService,
  type PackageManagerConfigBackup
} from './PackageManagerService.js';

/**
 * Service to manage local package installations in consuming projects.
 */
export class LocalPackageInstallService {
  /**
   * Installs a local package in the current project.
   *
   * @param packageName - Name of the package to install locally
   */
  async installLocalPackage(packageName: string): Promise<void> {
    const config = await ConfigService.loadConfig();
    const registryUrl = config.registryUrl || 'http://localhost:4873';
    const projectPath = process.cwd();
    const packageManager =
      await PackageManagerService.detectPackageManager(projectPath);

    let configBackup: PackageManagerConfigBackup = {};

    try {
      // Get the latest version from the local store
      const store = await LocalPackageStoreService.getStore();
      const packageEntry = store.packages[packageName];

      if (!packageEntry) {
        throw new Error(
          `Package ${packageName} not found in local store. Make sure it's being published.`
        );
      }

      DR.logger.info(
        `Installing ${packageName}@${packageEntry.currentVersion} from local registry using ${packageManager}...`
      );

      // Create registry configuration
      configBackup = await PackageManagerService.createRegistryConfig(
        packageManager,
        registryUrl,
        projectPath
      );

      // Install the specific version from the local registry
      await execa(
        packageManager,
        ['install', `${packageName}@${packageEntry.currentVersion}`],
        {
          stdio: 'inherit',
          cwd: projectPath
        }
      );

      DR.logger.info(
        `Successfully installed ${packageName}@${packageEntry.currentVersion}`
      );
    } catch (error) {
      DR.logger.error(
        `Failed to install local package ${packageName}: ${String(error)}`
      );
      throw error;
    } finally {
      // Always restore original configuration
      await PackageManagerService.restoreRegistryConfig(configBackup);
    }
  }

  /**
   * Removes a local package and installs the production version.
   *
   * @param packageName - Name of the package to uninstall locally
   */
  async uninstallLocalPackage(packageName: string): Promise<void> {
    const packageManager = await PackageManagerService.detectPackageManager(
      process.cwd()
    );

    try {
      DR.logger.info(
        `Removing local package ${packageName} and installing production version using ${packageManager}...`
      );

      // Install the production version (without specifying registry to use default npm)
      await execa(packageManager, ['install', packageName], {
        stdio: 'inherit'
      });

      DR.logger.info(`Successfully uninstalled local package ${packageName}`);
    } catch (error) {
      DR.logger.error(
        `Failed to uninstall local package ${packageName}: ${String(error)}`
      );
      throw error;
    }
  }

  /**
   * Updates a specific package to its latest local version.
   *
   * @param packageName - Name of the package to update
   */
  async updateLocalPackage(packageName: string): Promise<void> {
    const config = await ConfigService.loadConfig();
    const registryUrl = config.registryUrl || 'http://localhost:4873';
    const projectPath = process.cwd();
    const packageManager =
      await PackageManagerService.detectPackageManager(projectPath);

    let configBackup: PackageManagerConfigBackup = {};

    try {
      // Get the latest version from the local store
      const store = await LocalPackageStoreService.getStore();
      const packageEntry = store.packages[packageName];

      if (!packageEntry) {
        throw new Error(
          `Package ${packageName} not found in local store. Make sure it's being published.`
        );
      }

      DR.logger.info(
        `Updating ${packageName} to ${packageEntry.currentVersion} using ${packageManager}...`
      );

      // Update package.json first
      await this.updatePackageJsonForLocal([packageName]);

      // Create registry configuration
      configBackup = await PackageManagerService.createRegistryConfig(
        packageManager,
        registryUrl,
        projectPath
      );

      // Install the new version
      await execa(
        packageManager,
        ['install', `${packageName}@${packageEntry.currentVersion}`],
        {
          stdio: 'inherit',
          cwd: projectPath
        }
      );

      DR.logger.info(
        `Successfully updated ${packageName} to ${packageEntry.currentVersion}`
      );
    } catch (error) {
      DR.logger.error(`Failed to update ${packageName}: ${String(error)}`);
      throw error;
    } finally {
      // Always restore original configuration
      await PackageManagerService.restoreRegistryConfig(configBackup);
    }
  }

  /**
   * Updates the package.json in the current directory to use local versions of specified packages.
   *
   * @param packageNames - Array of package names to switch to local versions
   */
  async updatePackageJsonForLocal(packageNames: string[]): Promise<void> {
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    if (!(await fs.pathExists(packageJsonPath))) {
      throw new Error('No package.json found in current directory');
    }

    const store = await LocalPackageStoreService.getStore();
    const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;
    let hasChanges = false;

    for (const packageName of packageNames) {
      const packageEntry = store.packages[packageName];

      if (!packageEntry) {
        DR.logger.warn(`Local version not found for ${packageName}, skipping`);
        continue;
      }

      // Update in dependencies
      if (packageJson.dependencies && packageJson.dependencies[packageName]) {
        packageJson.dependencies[packageName] = packageEntry.currentVersion;
        hasChanges = true;
        DR.logger.info(
          `Updated ${packageName} to ${packageEntry.currentVersion} in dependencies`
        );
      }

      // Update in devDependencies
      if (
        packageJson.devDependencies &&
        packageJson.devDependencies[packageName]
      ) {
        packageJson.devDependencies[packageName] = packageEntry.currentVersion;
        hasChanges = true;
        DR.logger.info(
          `Updated ${packageName} to ${packageEntry.currentVersion} in devDependencies`
        );
      }

      // Update in peerDependencies
      if (
        packageJson.peerDependencies &&
        packageJson.peerDependencies[packageName]
      ) {
        packageJson.peerDependencies[packageName] = packageEntry.currentVersion;
        hasChanges = true;
        DR.logger.info(
          `Updated ${packageName} to ${packageEntry.currentVersion} in peerDependencies`
        );
      }
    }

    if (hasChanges) {
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      DR.logger.info('Updated package.json with local versions');
    } else {
      DR.logger.info('No changes needed in package.json');
    }
  }
}
