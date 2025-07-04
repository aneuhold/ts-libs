import { exec } from 'child_process';
import { access, readFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { PackageJson } from '../../types/PackageJson.js';
import { VersionType } from '../../types/VersionType.js';
import ErrorUtils from '../../utils/ErrorUtils.js';
import ChangelogService from '../ChangelogService/index.js';
import { DR } from '../DependencyRegistry.js';
import DependencyService from '../DependencyService.js';
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

  /**
   * Bumps the version if needed based on npm registry comparison and initializes changelog.
   * This operation is idempotent - it will only bump if the current version conflicts with
   * the registry, and changelog initialization won't modify existing content.
   *
   * First checks if there are changes compared to the main branch. If no changes are detected,
   * the method will exit early with success.
   *
   * @param versionType The type of version bump (patch, minor, major). Defaults to patch.
   * @param packagePath Optional path to the package directory (defaults to current working directory)
   */
  static async bumpVersionIfNeededAndInitializeChangelog(
    versionType: VersionType = VersionType.Patch,
    packagePath?: string
  ): Promise<void> {
    const { packageName, version: currentVersion } = await PackageServiceUtils.getPackageInfo();

    DR.logger.info(
      `Checking if version bump is needed for ${packageName} (current: ${currentVersion})`
    );

    // First, check if there are changes compared to the main branch
    // The method will auto-detect the current package directory if packagePath is not provided
    const hasChanges = await FileSystemService.hasChangesComparedToMain(packagePath);

    if (!hasChanges) {
      DR.logger.success(
        `No changes detected compared to main branch for ${packageName} - skipping version bump and changelog initialization`
      );
      return;
    }

    DR.logger.info(`Changes detected compared to main branch - proceeding with version check`);

    // Check if version bump is needed by comparing with npm registry
    const needsBump = await PackageServiceUtils.checkIfVersionBumpNeeded(
      packageName,
      currentVersion,
      versionType
    );

    let finalVersion = currentVersion;
    if (needsBump) {
      DR.logger.info(`Version bump needed - bumping ${versionType} version`);
      await DependencyService.bumpVersion(versionType);

      // Get the new version after bump
      const { version: newVersion } = await PackageServiceUtils.getPackageInfo();
      finalVersion = newVersion;
      DR.logger.success(`Version bumped from ${currentVersion} to ${finalVersion}`);
    } else {
      DR.logger.info('No version bump needed - current version is valid');
    }

    // Initialize changelog with the final version
    await ChangelogService.initializeChangelog(finalVersion, packageName, packagePath);

    DR.logger.success(`Version preparation completed for ${packageName} version ${finalVersion}`);
  }

  /**
   * Checks if a version bump is needed by comparing current version with npm registry
   * and considering the requested version type.
   *
   * @param packageName The package name to check
   * @param currentVersion The current version from package.json
   * @param versionType The type of version bump requested
   * @returns true if a version bump is needed, false otherwise
   */
  private static async checkIfVersionBumpNeeded(
    packageName: string,
    currentVersion: string,
    versionType: VersionType
  ): Promise<boolean> {
    DR.logger.info(`Checking npm registry for existing versions of ${packageName}...`);

    let latestVersion: string | null = null;

    try {
      const { stdout } = await execAsync(`npm view ${packageName}`);

      // Parse the npm view output to extract the latest version
      const latestVersionMatch = stdout.match(/latest:\s*([^\s|]+)/);
      if (latestVersionMatch) {
        latestVersion = latestVersionMatch[1];
        DR.logger.info(`Current version: ${currentVersion}, Latest on npm: ${latestVersion}`);
      }
    } catch (error) {
      const errorString = ErrorUtils.getErrorString(error);

      // If the package doesn't exist on npm, no bump needed for first publish
      if (errorString.includes('404') || errorString.includes('not found')) {
        DR.logger.info('Package not found on npm - no version bump needed for first publish.');
        return false;
      }

      // For other npm command errors, log but assume no bump needed to be safe
      DR.logger.warn(`Could not check npm registry: ${errorString}`);
      return false;
    }

    // Use the new logic to determine if bump is needed based on version type
    return StringService.shouldBumpVersion(currentVersion, latestVersion, versionType);
  }
}
