import { DR, type PackageJson } from '@aneuhold/core-ts-lib';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import {
  PACKAGE_MANAGER_INFO,
  PackageManager
} from '../types/PackageManager.js';
import { ConfigService } from './ConfigService.js';

export type PackageManagerConfigBackup = {
  npmrc?: { path: string; content: string | null };
  yarnrc?: { path: string; content: string | null };
  yarnrcYml?: { path: string; content: string | null };
};

/**
 * Utility service for various package managers.
 */
export class PackageManagerService {
  /**
   * Reads the package.json file in the specified directory.
   *
   * @param dir - Directory to search for package.json
   */
  static async getPackageInfo(
    dir: string = process.cwd()
  ): Promise<PackageJson | null> {
    try {
      const packageJsonPath = path.join(dir, 'package.json');
      const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;

      if (!packageJson.name || !packageJson.version) {
        throw new Error('package.json must contain name and version fields');
      }

      return packageJson;
    } catch (error) {
      DR.logger.error(`Error reading package.json: ${String(error)}`);
      return null;
    }
  }

  /**
   * Determines the package manager to use based on lock files and packageManager field in package.json.
   *
   * @param projectPath - Path to the project directory to check
   */
  static async detectPackageManager(
    projectPath: string
  ): Promise<PackageManager> {
    // First, try to determine from package.json packageManager field
    const packageInfo = await this.getPackageInfo(projectPath);
    if (packageInfo && packageInfo.packageManager) {
      const packageManagerField = packageInfo.packageManager.toLowerCase();

      // Check for Yarn 4.x vs Yarn Classic
      if (packageManagerField.includes('yarn')) {
        if (
          packageManagerField.includes('yarn@4') ||
          packageManagerField.includes('yarn@5') ||
          packageManagerField.includes('yarn@6')
        ) {
          return PackageManager.Yarn4;
        }
        return PackageManager.Yarn;
      }

      // Check for pnpm
      if (packageManagerField.includes('pnpm')) {
        return PackageManager.Pnpm;
      }

      // Check for npm
      if (packageManagerField.includes('npm')) {
        return PackageManager.Npm;
      }
    }

    // Fallback to lock file detection
    // Check for lock files in order of preference
    if (
      await fs.pathExists(
        path.join(
          projectPath,
          PACKAGE_MANAGER_INFO[PackageManager.Pnpm].lockFile
        )
      )
    ) {
      return PackageManager.Pnpm;
    }

    if (
      await fs.pathExists(
        path.join(
          projectPath,
          PACKAGE_MANAGER_INFO[PackageManager.Yarn].lockFile
        )
      )
    ) {
      // If we have a yarn.lock but no packageManager field, default to Yarn Classic
      return PackageManager.Yarn;
    }

    if (
      await fs.pathExists(
        path.join(
          projectPath,
          PACKAGE_MANAGER_INFO[PackageManager.Npm].lockFile
        )
      )
    ) {
      return PackageManager.Npm;
    }

    // Default to npm if no lock file is found
    return PackageManager.Npm;
  }

  /**
   * Runs install command in a project directory using the specified registry.
   *
   * @param projectPath - Path to the project directory
   * @param registryUrl - The registry URL to use for installation
   */
  static async runInstallWithRegistry(
    projectPath: string,
    registryUrl?: string
  ): Promise<void> {
    const config = await ConfigService.loadConfig();
    const actualRegistryUrl =
      registryUrl || config.registryUrl || 'http://localhost:4873';

    // Detect the package manager based on lock files in the target project
    const packageManager =
      await PackageManagerService.detectPackageManager(projectPath);

    // Create registry configuration to ensure packages are installed from local registry
    const configBackup = await PackageManagerService.createRegistryConfig(
      packageManager,
      actualRegistryUrl,
      projectPath
    );

    try {
      const packageManagerInfo = PACKAGE_MANAGER_INFO[packageManager];
      DR.logger.info(
        `Running ${packageManagerInfo.displayName} install in ${projectPath}`
      );
      await execa(packageManagerInfo.command, ['install'], {
        cwd: projectPath
      });
      DR.logger.info(
        `${packageManagerInfo.displayName} install completed in ${projectPath}`
      );
    } catch (error) {
      DR.logger.error(
        `Error running install in ${projectPath}: ${String(error)}`
      );
      throw error;
    } finally {
      // Always restore original configuration
      await PackageManagerService.restoreRegistryConfig(configBackup);
    }
  }

  /**
   * Creates registry configuration files for the specified package manager to use local registry.
   *
   * @param packageManager The package manager to configure
   * @param registryUrl The local registry URL
   * @param projectPath The path to the project directory
   */
  static async createRegistryConfig(
    packageManager: PackageManager,
    registryUrl: string,
    projectPath: string
  ): Promise<PackageManagerConfigBackup> {
    const backup: PackageManagerConfigBackup = {};
    const packageManagerInfo = PACKAGE_MANAGER_INFO[packageManager];

    const configPath = path.join(projectPath, packageManagerInfo.configFile);
    const existingContent = (await fs.pathExists(configPath))
      ? await fs.readFile(configPath, 'utf8')
      : null;

    // Store backup based on config file type
    if (packageManagerInfo.configFile === '.npmrc') {
      backup.npmrc = { path: configPath, content: existingContent };
    } else if (packageManagerInfo.configFile === '.yarnrc') {
      backup.yarnrc = { path: configPath, content: existingContent };
    } else if (packageManagerInfo.configFile === '.yarnrc.yml') {
      backup.yarnrcYml = { path: configPath, content: existingContent };
    }

    // Create registry configuration using the package manager's format
    const registryConfig = packageManagerInfo.configFormat(registryUrl);
    await fs.writeFile(configPath, registryConfig);

    return backup;
  }

  /**
   * Restores the original registry configuration files.
   *
   * @param backup The backup of original configurations
   */
  static async restoreRegistryConfig(
    backup: PackageManagerConfigBackup
  ): Promise<void> {
    for (const config of Object.values(backup)) {
      if (config.content === null) {
        // File didn't exist originally, remove it
        if (await fs.pathExists(config.path)) {
          await fs.remove(config.path);
        }
      } else {
        // Restore original content
        await fs.writeFile(config.path, config.content);
      }
    }
  }
}
