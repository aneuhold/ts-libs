import { DR } from '@aneuhold/core-ts-lib';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { DEFAULT_CONFIG } from '../../types/LocalNpmConfig.js';
import { PACKAGE_MANAGER_INFO, PackageManager } from '../../types/PackageManager.js';
import { ConfigService } from '../ConfigService.js';
import { PackageJsonService } from '../PackageJsonService.js';
import { RegistryConfigService } from './RegistryConfigService/RegistryConfigService.js';

/**
 * Utility service for various package managers.
 */
export class PackageManagerService {
  /**
   * Cache to store detected package managers for projects.
   */
  private static configCache = new Map<
    string,
    {
      packageManager: PackageManager;
      timestamp: number;
    }
  >();
  private static readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Determines the package manager to use based on lock files and packageManager field in package.json.
   * Uses caching to reduce file I/O operations.
   *
   * @param projectPath - Path to the project directory to check
   */
  static async detectPackageManager(projectPath: string): Promise<PackageManager> {
    const cacheKey = projectPath;
    const cached = this.configCache.get(cacheKey);

    // Check if cache is still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.packageManager;
    }

    // Cache miss or expired, detect package manager
    const packageManager = await this.detectPackageManagerUncached(projectPath);

    // Cache the result
    this.configCache.set(projectPath, {
      packageManager,
      timestamp: Date.now()
    });

    return packageManager;
  }

  /**
   * Clears the package manager cache for a specific project or all projects.
   *
   * @param projectPath - Optional path to clear cache for specific project
   */
  static clearCache(projectPath?: string): void {
    if (projectPath) {
      this.configCache.delete(projectPath);
    } else {
      this.configCache.clear();
    }
  }

  /**
   * Runs install command in a project directory using the default registry (npm, yarn, etc.).
   *
   * @param projectPath - Path to the project directory
   */
  static async runInstall(projectPath: string): Promise<void> {
    // Detect the package manager based on lock files in the target project
    const packageManager = await PackageManagerService.detectPackageManager(projectPath);

    const packageManagerInfo = PACKAGE_MANAGER_INFO[packageManager];

    try {
      DR.logger.info(`Running ${packageManagerInfo.displayName} install in ${projectPath}`);
      await execa(packageManagerInfo.command, ['install'], {
        cwd: projectPath
      });
      DR.logger.info(`${packageManagerInfo.displayName} install completed in ${projectPath}`);
    } catch (error) {
      DR.logger.error(`Error running install in ${projectPath}: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Runs install command in a project directory using the specified registry.
   *
   * @param projectPath - Path to the project directory
   * @param registryUrl - The registry URL to use for installation
   */
  static async runInstallWithRegistry(projectPath: string, registryUrl?: string): Promise<void> {
    const config = await ConfigService.loadConfig();
    const actualRegistryUrl = registryUrl || config.registryUrl || DEFAULT_CONFIG.registryUrl;

    // Detect the package manager based on lock files in the target project
    const packageManager = await PackageManagerService.detectPackageManager(projectPath);

    // Create registry configuration to ensure packages are installed from local registry
    const configBackup = await RegistryConfigService.createRegistryConfig(
      packageManager,
      actualRegistryUrl,
      projectPath
    );

    try {
      // Use the base runInstall method to perform the actual installation
      await this.runInstall(projectPath);
    } catch (error) {
      DR.logger.error(`Error running install with registry in ${projectPath}: ${String(error)}`);
      throw error;
    } finally {
      // Always restore original configuration
      await RegistryConfigService.restoreRegistryConfig(configBackup);
    }
  }

  /**
   * Detects the package manager without caching.
   *
   * @param projectPath - Path to the project directory to check
   */
  private static async detectPackageManagerUncached(projectPath: string): Promise<PackageManager> {
    // First, try to determine from package.json packageManager field
    const packageInfo = await PackageJsonService.getPackageInfo(projectPath, false);
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
        path.join(projectPath, PACKAGE_MANAGER_INFO[PackageManager.Pnpm].lockFile)
      )
    ) {
      return PackageManager.Pnpm;
    }

    if (
      await fs.pathExists(
        path.join(projectPath, PACKAGE_MANAGER_INFO[PackageManager.Yarn].lockFile)
      )
    ) {
      // If we have a yarn.lock but no packageManager field, default to Yarn Classic
      return PackageManager.Yarn;
    }

    if (
      await fs.pathExists(path.join(projectPath, PACKAGE_MANAGER_INFO[PackageManager.Npm].lockFile))
    ) {
      return PackageManager.Npm;
    }

    // Default to npm if no lock file is found
    return PackageManager.Npm;
  }
}
