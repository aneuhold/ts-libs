import { exec } from 'child_process';
import { access, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { PackageJson } from '../../types/PackageJson.js';
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
   * Replaces imports of monorepo dependencies with npm: specifiers in all TypeScript files.
   * This is needed for JSR compatibility when publishing packages that depend on other packages in the monorepo.
   *
   * This helps prevent the following error that comes up as of 5/26/2025:
   *
   * ```sh
   * error: Failed to publish @aneuhold/be-ts-lib@2.0.67
   * Caused by: Failed to publish @aneuhold/be-ts-lib at 2.0.67: failed to build module graph: Module not found "file:///src/services/@aneuhold/core-ts-lib".
   *      at file:///src/services/GitHubService.ts:1:20
   * ```
   */
  static async replaceMonorepoImportsWithNpmSpecifiers(): Promise<void> {
    const rootDir = process.cwd();
    const srcDir = path.join(rootDir, 'src');

    try {
      await access(srcDir);
    } catch {
      DR.logger.error('No src directory found in the current directory.');
      return;
    }

    // Get all packages in the monorepo to know which ones to replace
    const childPackages = await DependencyService.getChildPackageJsons('../');
    const packageNames = Object.keys(childPackages);

    if (packageNames.length === 0) {
      DR.logger.info('No monorepo packages found to replace.');
      return;
    }

    // Create maps for package specifiers and pre-compiled regex patterns
    const packageSpecifierMap = new Map<string, string>();
    const packageRegexMap = new Map<string, RegExp>();

    for (const [packageName, packageInfo] of Object.entries(childPackages)) {
      const version = packageInfo.packageJsonContents.version;
      // The below HAS to be a carrot (^) to ensure that the version is compatible with JSR.
      // As of 5/26/2025, inline imports with versions don't seem to support the *
      // wildcard, so we use a caret (^) to allow for minor version updates. This
      // can cause problems, but it is accepted for now.
      // Here is an example error that comes up if we don't use a caret:
      // ```sh
      // error: Invalid package specifier 'npm:@aneuhold/core-ts-lib@*2.1.7'
      // 0: Invalid specifier version requirement
      // 1: Unexpected character.
      //      2.1.7
      //      ~
      // at file:///Users/aneuhold/Development/GithubRepos/ts-libs/packages/be-ts-lib/src/services/ConfigService/ConfigService.ts:1:20
      // ```
      const npmSpecifier = `npm:${packageName}@^${version}`;
      packageSpecifierMap.set(packageName, npmSpecifier);

      // Pre-compile regex pattern for this package
      const importRegex = new RegExp(
        `(import\\s+[^;]+from\\s+['"])${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['"])`,
        'g'
      );
      packageRegexMap.set(packageName, importRegex);
    }

    // Get all TypeScript files in the src directory
    const allFiles = await FileSystemService.getAllFilePathsRelative(srcDir);
    const tsFiles = allFiles
      .filter((filePath) => filePath.endsWith('.ts') && !filePath.endsWith('.spec.ts'))
      .map((filePath) => path.join(srcDir, filePath));

    DR.logger.info(
      `Replacing monorepo imports with npm: specifiers in ${tsFiles.length} TypeScript files...`
    );

    let totalReplacements = 0;

    for (const filePath of tsFiles) {
      try {
        const content = await readFile(filePath, 'utf-8');
        let newContent = content;
        let fileReplacements = 0;

        for (const [packageName, npmSpecifier] of packageSpecifierMap) {
          // Use the pre-compiled regex pattern
          const importRegex = packageRegexMap.get(packageName);
          if (!importRegex) continue;

          // Reset the regex lastIndex to ensure it starts from the beginning
          importRegex.lastIndex = 0;

          const matches = newContent.match(importRegex);

          if (matches) {
            newContent = newContent.replace(importRegex, `$1${npmSpecifier}$2`);
            fileReplacements += matches.length;
            DR.logger.info(
              `    Replaced ${packageName} with ${npmSpecifier} (${matches.length} occurrences)`
            );
          }
        }

        if (fileReplacements > 0) {
          await writeFile(filePath, newContent);
          totalReplacements += fileReplacements;
          DR.logger.info(
            `  Updated: ${path.relative(rootDir, filePath)} (${fileReplacements} replacements)`
          );
        }
      } catch (error) {
        DR.logger.error(`Failed to process file ${filePath}: ${ErrorUtils.getErrorString(error)}`);
      }
    }

    DR.logger.info(
      `Completed monorepo import replacement: ${totalReplacements} total replacements made`
    );
  }

  /**
   * Resolves wildcard dependencies in package.json by replacing them with actual
   * version constraints (e.g., "*1.2.3") for JSR compatibility. This will
   * write the modified package.json back to disk.
   *
   * @param packageJsonData The package.json data to modify
   * @param packageJsonPath The path to the package.json file
   */
  static async resolveWildcardDependenciesInPackageJson(
    packageJsonData: PackageJson,
    packageJsonPath: string
  ): Promise<void> {
    try {
      // Get all packages one directory up to resolve local wildcard dependencies
      const childPackages = await DependencyService.getChildPackageJsons('../');

      // Helper function to resolve dependencies
      const resolveDependencies = (deps: Record<string, string> | undefined): void => {
        if (!deps) return;

        for (const [depName, depVersion] of Object.entries(deps)) {
          if (depVersion === '*' && depName in childPackages) {
            // Replace wildcard with "*" + actual version from the monorepo
            deps[depName] = `*${childPackages[depName].packageJsonContents.version}`;
          }
        }
      };

      // Resolve each dependency type
      resolveDependencies(packageJsonData.dependencies);
      resolveDependencies(packageJsonData.devDependencies);
      resolveDependencies(packageJsonData.peerDependencies);
      resolveDependencies(packageJsonData.optionalDependencies);

      // Write the updated package.json
      await writeFile(packageJsonPath, JSON.stringify(packageJsonData, null, 2));

      DR.logger.info('Resolved wildcard dependencies in package.json for JSR compatibility');
    } catch (error) {
      const errorString = ErrorUtils.getErrorString(error);
      DR.logger.error(`Failed to resolve wildcard dependencies: ${errorString}`);
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
