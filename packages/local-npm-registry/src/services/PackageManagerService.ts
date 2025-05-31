import { DR } from '@aneuhold/core-ts-lib';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
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
   * Determines the package manager to use based on lock files in the specified directory.
   *
   * @param projectPath - Path to the project directory to check
   */
  static async detectPackageManager(projectPath: string): Promise<string> {
    // Check for lock files in order of preference
    if (await fs.pathExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }

    if (await fs.pathExists(path.join(projectPath, 'yarn.lock'))) {
      return 'yarn';
    }

    if (await fs.pathExists(path.join(projectPath, 'package-lock.json'))) {
      return 'npm';
    }

    // Default to npm if no lock file is found
    return 'npm';
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
      DR.logger.info(`Running ${packageManager} install in ${projectPath}`);
      await execa(packageManager, ['install'], { cwd: projectPath });
      DR.logger.info(`${packageManager} install completed in ${projectPath}`);
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
    packageManager: string,
    registryUrl: string,
    projectPath: string
  ): Promise<PackageManagerConfigBackup> {
    const backup: PackageManagerConfigBackup = {};

    switch (packageManager) {
      case 'npm':
      case 'pnpm': {
        const npmrcPath = path.join(projectPath, '.npmrc');
        const existingContent = (await fs.pathExists(npmrcPath))
          ? await fs.readFile(npmrcPath, 'utf8')
          : null;

        backup.npmrc = { path: npmrcPath, content: existingContent };

        // Create or append to .npmrc
        const registryConfig = `registry=${registryUrl}\n`;
        await fs.writeFile(npmrcPath, registryConfig);
        break;
      }
      case 'yarn': {
        const yarnrcPath = path.join(projectPath, '.yarnrc');
        const existingContent = (await fs.pathExists(yarnrcPath))
          ? await fs.readFile(yarnrcPath, 'utf8')
          : null;

        backup.yarnrc = { path: yarnrcPath, content: existingContent };

        // Create or append to .yarnrc
        const registryConfig = `registry "${registryUrl}"\n`;
        await fs.writeFile(yarnrcPath, registryConfig);
        break;
      }
      case 'yarn4': {
        const yarnrcYmlPath = path.join(projectPath, '.yarnrc.yml');
        const existingContent = (await fs.pathExists(yarnrcYmlPath))
          ? await fs.readFile(yarnrcYmlPath, 'utf8')
          : null;

        backup.yarnrcYml = { path: yarnrcYmlPath, content: existingContent };

        // Create or append to .yarnrc.yml
        const registryConfig = `npmRegistryServer: "${registryUrl}"\n`;
        await fs.writeFile(yarnrcYmlPath, registryConfig);
        break;
      }
    }

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
