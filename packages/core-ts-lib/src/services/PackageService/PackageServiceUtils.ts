import { exec } from 'child_process';
import { access, readFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { PackageJson } from '../../types/PackageJson.js';
import ErrorUtils from '../../utils/ErrorUtils.js';
import ChangelogService from '../ChangelogService/index.js';
import { DR } from '../DependencyRegistry.js';
import FileSystemService from '../FileSystemService/FileSystemService.js';
import StringService from '../StringService.js';

const execAsync = promisify(exec);

/**
 * Utility service containing common functionality shared between JSR and NPM package services.
 */
export default class PackageServiceUtils {
  /**
   * Gets the package name and version from package.json.
   *
   * @returns An object containing the package name and version
   */
  static async getPackageInfo(): Promise<{
    packageName: string;
    version: string;
  }> {
    const rootDir = process.cwd();
    const packageJsonPath = path.join(rootDir, 'package.json');

    try {
      await access(packageJsonPath);
    } catch {
      throw new Error('No package.json file found in the current directory.');
    }

    try {
      const packageJsonData = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as PackageJson;

      return {
        packageName: packageJsonData.name,
        version: packageJsonData.version
      };
    } catch (error) {
      const errorString = ErrorUtils.getErrorString(error);
      DR.logger.error(`Failed to read package.json: ${errorString}`);
      throw error;
    }
  }

  /**
   * Validates the current project for changes and changelog before publishing.
   *
   * @param currentVersion The current version to validate changelog for
   */
  static async validatePrePublishRequirements(currentVersion: string): Promise<void> {
    if (await FileSystemService.hasPendingChanges()) {
      DR.logger.error('Please commit or stash your changes before publishing.');
      process.exit(1);
    }

    // Validate changelog for the current version before proceeding
    await ChangelogService.validateChangelogForVersion(currentVersion);
  }

  /**
   * Common logic for checking version conflicts between current and latest versions.
   *
   * @param currentVersion The current version from package.json
   * @param latestVersion The latest published version
   * @param registryName The name of the registry (for error messages)
   */
  static checkVersionConflict(
    currentVersion: string,
    latestVersion: string,
    registryName: string
  ): void {
    DR.logger.info(
      `Current version: ${currentVersion}, Latest on ${registryName}: ${latestVersion}`
    );

    // Compare versions using semver-like comparison
    const comparison = StringService.compareSemanticVersions(currentVersion, latestVersion);

    if (comparison === 0) {
      throw new Error(
        `Version ${currentVersion} already exists on ${registryName}. Please bump the version before publishing.`
      );
    } else if (comparison < 0) {
      throw new Error(
        `Current version ${currentVersion} is lower than the latest published version ${latestVersion} on ${registryName}. Please bump the version.`
      );
    }

    DR.logger.info('Version check passed - ready to publish.');
  }

  /**
   * Replaces the package name in all files in the root directory, but no child directories,
   * with a new name.
   *
   * @param originalPackageName The original package name to replace
   * @param newPackageName The new package name to use
   */
  static async replacePackageName(
    originalPackageName: string,
    newPackageName: string
  ): Promise<void> {
    DR.logger.info(`Replacing package name from "${originalPackageName}" to "${newPackageName}"`);

    const rootDir = process.cwd();

    // Replace in all files in the root directory
    await FileSystemService.replaceInFiles({
      searchString: originalPackageName,
      replaceString: newPackageName,
      rootPath: rootDir,
      includePatterns: ['*'],
      excludePatterns: []
    });

    DR.logger.info(`Successfully replaced package name in configuration files`);
  }

  /**
   * Performs a git reset to discard all changes in the working directory.
   * This is used between alternative package name operations.
   */
  static async resetGitChanges(): Promise<void> {
    DR.logger.info('Resetting git changes');
    try {
      await execAsync('git reset --hard HEAD');
    } catch (error) {
      DR.logger.error(`Failed to reset git changes: ${ErrorUtils.getErrorString(error)}`);
      throw error;
    }
  }

  /**
   * Initializes a changelog for the current project if one doesn't exist.
   * This operation is idempotent - it won't modify existing content.
   *
   * @param packagePath Optional path to the package directory (defaults to current working directory)
   */
  static async initializeChangelog(packagePath?: string): Promise<void> {
    const { packageName, version } = await PackageServiceUtils.getPackageInfo();
    await ChangelogService.initializeChangelog(version, packageName, packagePath);
  }
}
