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

    // Create or merge registry configuration using the package manager's format
    const registryConfig = packageManagerInfo.configFormat(registryUrl);
    let finalConfigContent: string;

    if (existingContent) {
      // Merge with existing content
      finalConfigContent = this.mergeConfigContent(
        existingContent,
        registryConfig,
        packageManagerInfo.configFile
      );
    } else {
      // No existing content, use new config directly
      finalConfigContent = registryConfig;
    }

    await fs.writeFile(configPath, finalConfigContent);

    // Handle .npmrc file for authentication token
    await this.createOrUpdateNpmrcAuth(
      projectPath,
      registryUrl,
      packageManagerInfo.configFile,
      backup
    );

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

  /**
   * Creates or updates the .npmrc file with authentication token for the registry.
   *
   * @param projectPath The path to the project directory
   * @param registryUrl The registry URL
   * @param configFile The config file being used by the package manager
   * @param backup The backup object to store .npmrc backup if needed
   */
  private static async createOrUpdateNpmrcAuth(
    projectPath: string,
    registryUrl: string,
    configFile: string,
    backup: PackageManagerConfigBackup
  ): Promise<void> {
    // Always create/update .npmrc file with authentication token
    const npmrcPath = path.join(projectPath, '.npmrc');
    const existingNpmrcContent = (await fs.pathExists(npmrcPath))
      ? await fs.readFile(npmrcPath, 'utf8')
      : null;

    // Only backup .npmrc if we haven't already backed it up above
    if (configFile !== '.npmrc') {
      backup.npmrc = { path: npmrcPath, content: existingNpmrcContent };
    }

    // Create the auth token line for .npmrc
    const url = registryUrl.replace('http://', '');
    const authTokenLine = `//${url}/:_authToken=fake`;

    // Create or update .npmrc content using merge logic
    let npmrcContent = existingNpmrcContent || '';

    // Use the same merge logic as the main config files
    if (npmrcContent.trim() === '') {
      npmrcContent = authTokenLine;
    } else {
      npmrcContent = this.mergeConfigContent(
        npmrcContent,
        authTokenLine,
        '.npmrc'
      );
    }

    await fs.writeFile(npmrcPath, npmrcContent);
  }

  /**
   * Merges new configuration content with existing configuration content.
   *
   * @param existingContent The existing configuration file content
   * @param newConfig The new configuration content to merge
   * @param configFile The configuration file name to determine merge strategy
   */
  private static mergeConfigContent(
    existingContent: string,
    newConfig: string,
    configFile: string
  ): string {
    if (configFile === '.yarnrc.yml') {
      // For YAML files, merge by checking if content already exists
      const lines = existingContent.split('\n');
      const newLines = newConfig
        .split('\n')
        .filter((line) => line.trim() !== '');

      for (const newLine of newLines) {
        const [key] = newLine.split(':');
        const keyTrimmed = key.trim();

        if (keyTrimmed) {
          // Check if this key already exists
          const existingLineIndex = lines.findIndex((line) =>
            line.trim().startsWith(keyTrimmed + ':')
          );

          if (existingLineIndex >= 0) {
            // Replace existing line
            lines[existingLineIndex] = newLine;
          } else {
            // Add new line
            lines.push(newLine);
          }
        }
      }

      return lines.join('\n');
    } else {
      // For .npmrc and .yarnrc files, merge by checking if lines already exist
      const existingLines = existingContent.split('\n');
      const newLines = newConfig
        .split('\n')
        .filter((line) => line.trim() !== '');

      for (const newLine of newLines) {
        const [key] = newLine.split('=');
        const keyTrimmed = key.trim();

        if (keyTrimmed) {
          // Check if this key already exists
          const existingLineIndex = existingLines.findIndex((line) =>
            line.trim().startsWith(keyTrimmed + '=')
          );

          if (existingLineIndex >= 0) {
            // Replace existing line
            existingLines[existingLineIndex] = newLine;
          } else {
            // Add new line
            existingLines.push(newLine);
          }
        }
      }

      return existingLines.join('\n');
    }
  }
}
