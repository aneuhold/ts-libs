import { exec, spawn } from 'child_process';
import { access, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { JsonWithVersionProperty } from '../types/JsonWithVersionProperty.js';
import { PackageJson } from '../types/PackageJson.js';
import ErrorUtils from '../utils/ErrorUtils.js';
import { DR } from './DependencyRegistry.js';
import DependencyService from './DependencyService.js';
import FileSystemService from './FileSystemService/FileSystemService.js';
import StringService from './StringService.js';

const execAsync = promisify(exec);

/**
 * A service which can be used to assist in publishing or validating packages
 * for the current project.
 */
export default class PackageService {
  /**
   * Validates the current project for publishing to JSR. This will check if the
   * project has any pending changes first, then update the version of the
   * jsr.json to match the package.json file, then run the
   * `jsr publish --dry-run` command, and finally cleanup the changes made.
   *
   * @param alternativePackageNames Optional array of alternative package names to validate publishing under
   *
   * **Warning:** This method uses simple string replacement for package names, which may have unintended effects
   * if the package name appears in unexpected places. Use with caution.
   */
  static async validateJsrPublish(alternativePackageNames?: string[]): Promise<void> {
    if (await FileSystemService.hasPendingChanges()) {
      DR.logger.error('Please commit or stash your changes before publishing.');
      process.exit(1);
    }

    const { packageName: originalPackageName } = await PackageService.getPackageInfo();
    const packageNamesToValidate = [originalPackageName, ...(alternativePackageNames || [])];

    for (const packageName of packageNamesToValidate) {
      const isAlternativeName = packageName !== originalPackageName;

      DR.logger.info(`Validating JSR publishing for package: ${packageName}`);

      if (isAlternativeName) {
        await PackageService.replacePackageName(originalPackageName, packageName);
      }

      await PackageService.replaceMonorepoImportsWithNpmSpecifiers();
      const { version: currentVersion } = await PackageService.updateJsrFromPackageJson();
      const successfulDryRun = await PackageService.publishJsrDryRun(packageName, currentVersion);

      await PackageService.resetGitChanges();

      if (!successfulDryRun) {
        process.exit(1);
      }
    }

    DR.logger.success('Successfully validated JSR publishing for all package names.');
  }

  /**
   * Publishes the current project to JSR.
   *
   * @param alternativePackageNames Optional array of alternative package names to publish under
   *
   * **Warning:** This method uses simple string replacement for package names, which may have unintended effects
   * if the package name appears in unexpected places. Use with caution.
   */
  static async publishToJsr(alternativePackageNames?: string[]): Promise<void> {
    if (await FileSystemService.hasPendingChanges()) {
      DR.logger.error('Please commit or stash your changes before publishing.');
      process.exit(1);
    }

    const { packageName: originalPackageName } = await PackageService.getPackageInfo();
    const packageNamesToPublish = [originalPackageName, ...(alternativePackageNames || [])];

    for (const packageName of packageNamesToPublish) {
      const isAlternativeName = packageName !== originalPackageName;

      DR.logger.info(`Publishing to JSR for package: ${packageName}`);

      if (isAlternativeName) {
        await PackageService.replacePackageName(originalPackageName, packageName);
      }

      await PackageService.replaceMonorepoImportsWithNpmSpecifiers();
      await PackageService.updateJsrFromPackageJson();
      const result = await PackageService.publishJsr();

      await PackageService.resetGitChanges();

      if (!result) {
        process.exit(1);
      }
    }

    DR.logger.success('Successfully published to JSR for all package names.');
  }

  /**
   * Validates the current project for publishing to npm. This will run
   * `npm publish --access public --dry-run` and check for version conflicts
   * on the npm registry.
   *
   * @param alternativePackageNames Optional array of alternative package names to validate publishing under
   *
   * **Warning:** This method uses simple string replacement for package names, which may have unintended effects
   * if the package name appears in unexpected places. Use with caution.
   */
  static async validateNpmPublish(alternativePackageNames?: string[]): Promise<void> {
    if (await FileSystemService.hasPendingChanges()) {
      DR.logger.error('Please commit or stash your changes before publishing.');
      process.exit(1);
    }

    const { packageName: originalPackageName, version: currentVersion } =
      await PackageService.getPackageInfo();
    const packageNamesToValidate = [originalPackageName, ...(alternativePackageNames || [])];

    for (const packageName of packageNamesToValidate) {
      const isAlternativeName = packageName !== originalPackageName;

      DR.logger.info(`Validating npm publishing for package: ${packageName}`);

      if (isAlternativeName) {
        await PackageService.replacePackageName(originalPackageName, packageName);
      }

      const successfulDryRun = await PackageService.publishNpmDryRun();
      if (!successfulDryRun) {
        if (isAlternativeName) {
          await PackageService.resetGitChanges();
        }
        process.exit(1);
      }

      await PackageService.checkNpmVersionConflicts(packageName, currentVersion);

      if (isAlternativeName) {
        await PackageService.resetGitChanges();
      }
    }

    DR.logger.success('Successfully validated npm publishing for all package names.');
  }

  /**
   * Publishes the current project to npm.
   *
   * @param alternativePackageNames Optional array of alternative package names to publish under
   *
   * **Warning:** This method uses simple string replacement for package names, which may have unintended effects
   * if the package name appears in unexpected places. Use with caution.
   */
  static async publishToNpm(alternativePackageNames?: string[]): Promise<void> {
    if (await FileSystemService.hasPendingChanges()) {
      DR.logger.error('Please commit or stash your changes before publishing.');
      process.exit(1);
    }

    const { packageName: originalPackageName } = await PackageService.getPackageInfo();
    const packageNamesToPublish = [originalPackageName, ...(alternativePackageNames || [])];

    for (const packageName of packageNamesToPublish) {
      const isAlternativeName = packageName !== originalPackageName;

      DR.logger.info(`Publishing to npm for package: ${packageName}`);

      if (isAlternativeName) {
        await PackageService.replacePackageName(originalPackageName, packageName);
      }

      const result = await PackageService.publishNpm();

      if (isAlternativeName) {
        await PackageService.resetGitChanges();
      }

      if (!result) {
        process.exit(1);
      }
    }

    DR.logger.success('Successfully published to npm for all package names.');
  }

  /**
   * Test method for string replacement functionality. This method allows testing
   * the string replacement behavior without performing actual publishing operations.
   *
   * @param originalString The original string to replace
   * @param newString The new string to replace it with
   *
   * **Warning:** This method uses simple string replacement, which may have unintended effects
   * if the string appears in unexpected places. Use with caution.
   */
  static async testStringReplacement(originalString: string, newString: string): Promise<void> {
    DR.logger.info(`Testing string replacement from "${originalString}" to "${newString}"`);

    await PackageService.replacePackageName(originalString, newString);

    DR.logger.info('Test completed - package name replacement has been applied');
  }

  /**
   * Updates the jsr.json file from the package.json file and resolves wildcard
   * dependencies in package.json for JSR compatibility.
   *
   * @returns An object containing the package name and version from jsr.json and package.json
   */
  private static async updateJsrFromPackageJson(): Promise<{
    packageName: string;
    version: string;
  }> {
    const rootDir = process.cwd();
    const packageJsonPath = path.join(rootDir, 'package.json');
    const jsrJsonPath = path.join(rootDir, 'jsr.json');

    try {
      await access(jsrJsonPath);
    } catch {
      throw new Error('No jsr.json file found in the current directory.');
    }

    try {
      const { packageName, version } = await PackageService.getPackageInfo();
      const packageJsonData = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as PackageJson;
      const jsrJsonData = JSON.parse(
        await readFile(jsrJsonPath, 'utf-8')
      ) as JsonWithVersionProperty;

      // Update JSR version
      jsrJsonData.version = version;

      // Resolve wildcard dependencies in package.json for JSR compatibility
      await this.resolveWildcardDependenciesInPackageJson(packageJsonData, packageJsonPath);

      await writeFile(jsrJsonPath, JSON.stringify(jsrJsonData, null, 2));
      DR.logger.info('Updated jsr.json from package.json to version ' + version);

      return {
        packageName,
        version
      };
    } catch (error) {
      const errorString = ErrorUtils.getErrorString(error);
      DR.logger.error(`Failed to update jsr.json from package.json: ${errorString}`);
      throw error;
    }
  }

  /**
   * Resolves wildcard dependencies in package.json by replacing them with actual
   * version constraints (e.g., "*1.2.3") for JSR compatibility. This will
   * write the modified package.json back to disk.
   *
   * @param packageJsonData The package.json data to modify
   * @param packageJsonPath The path to the package.json file
   */
  private static async resolveWildcardDependenciesInPackageJson(
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
   * Executes a dry run of JSR publishing. Returns true if the dry run was
   * successful, false otherwise. Also checks for existing versions on JSR
   * and throws an error if the current version already exists or if a higher
   * version is already published.
   *
   * @param packageName The package name from jsr.json
   * @param currentVersion The current version from package.json
   */
  private static async publishJsrDryRun(
    packageName: string,
    currentVersion: string
  ): Promise<boolean> {
    // Check for existing versions on JSR first
    await this.checkJsrVersionConflicts(packageName, currentVersion);

    DR.logger.info('Running `jsr publish --dry-run`');
    try {
      const { stdout, stderr } = await execAsync('jsr publish --allow-dirty --dry-run');
      if (stderr) {
        DR.logger.info(stderr);
      }
      DR.logger.info(stdout);
    } catch (error) {
      DR.logger.error(`Failed to run 'jsr publish --dry-run': ${ErrorUtils.getErrorString(error)}`);
      return false;
    }
    return true;
  }

  /**
   * Publishes the current project to JSR.
   *
   * @returns true if the publish was successful, false otherwise.
   */
  private static async publishJsr(): Promise<boolean> {
    DR.logger.info('Running `jsr publish`');
    return new Promise((resolve) => {
      const child = spawn('jsr publish', ['--allow-dirty'], {
        stdio: 'inherit',
        shell: true
      });

      child.on('exit', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  /**
   * Gets the package name and version from package.json.
   *
   * @returns An object containing the package name and version
   */
  private static async getPackageInfo(): Promise<{
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
   * Executes a dry run of npm publishing.
   *
   * @returns true if the dry run was successful, false otherwise.
   */
  private static async publishNpmDryRun(): Promise<boolean> {
    DR.logger.info('Running `npm publish --access public --dry-run`');
    try {
      await execAsync('npm publish --access public --dry-run');
      DR.logger.info('npm dry run completed successfully.');
    } catch (error) {
      const errorString = ErrorUtils.getErrorString(error);
      DR.logger.error(`npm dry run failed: ${errorString}`);
      return false;
    }
    return true;
  }

  /**
   * Checks npm registry for package information and performs version conflict checks.
   *
   * @param packageName The package name from package.json
   * @param currentVersion The current version from package.json
   */
  private static async checkNpmVersionConflicts(
    packageName: string,
    currentVersion: string
  ): Promise<void> {
    DR.logger.info(`Checking npm registry for existing versions of ${packageName}...`);

    try {
      const { stdout } = await execAsync(`npm view ${packageName}`);

      // Parse the npm view output to extract the latest version
      const latestVersionMatch = stdout.match(/latest:\s*([^\s|]+)/);
      if (latestVersionMatch) {
        const latestVersion = latestVersionMatch[1];
        PackageService.checkVersionConflict(currentVersion, latestVersion, 'npm');
      }
    } catch (error) {
      const errorString = ErrorUtils.getErrorString(error);

      // If the package doesn't exist on npm, that's fine for first publish
      if (errorString.includes('404') || errorString.includes('not found')) {
        DR.logger.info('Package not found on npm - this appears to be a first publish.');
        return;
      }

      // Re-throw version conflict errors
      if (errorString.includes('already exists') || errorString.includes('is lower than')) {
        throw error;
      }

      // For other npm command errors, log but don't block
      DR.logger.warn(`Could not check npm registry: ${errorString}`);
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
  private static async replaceMonorepoImportsWithNpmSpecifiers(): Promise<void> {
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
   * Checks for version conflicts on JSR by looking up the current package
   * and comparing versions. Throws an error if the current version already
   * exists or if a higher version is already published.
   *
   * @param packageName The package name from jsr.json
   * @param currentVersion The current version from package.json
   */
  private static async checkJsrVersionConflicts(
    packageName: string,
    currentVersion: string
  ): Promise<void> {
    DR.logger.info(`Checking JSR for existing versions of ${packageName}...`);

    try {
      const { stdout } = await execAsync(`jsr view ${packageName}`);

      // Parse the JSR view output to extract the latest version
      const latestVersionMatch = stdout.match(/latest:\s*([^\s|]+)/);
      if (latestVersionMatch) {
        const latestVersion = latestVersionMatch[1];

        PackageService.checkVersionConflict(currentVersion, latestVersion, 'JSR');
      }
    } catch (error) {
      const errorString = ErrorUtils.getErrorString(error);

      // If the package doesn't exist on JSR, that's fine for first publish
      if (errorString.includes('Package not found') || errorString.includes('404')) {
        DR.logger.info('Package not found on JSR - this appears to be a first publish.');
        return;
      }

      // Re-throw version conflict errors
      if (errorString.includes('already exists') || errorString.includes('is lower than')) {
        throw error;
      }

      // For other JSR command errors, log but don't block
      DR.logger.warn(`Could not check JSR versions: ${errorString}`);
    }
  }

  /**
   * Common logic for checking version conflicts between current and latest versions.
   *
   * @param currentVersion The current version from package.json
   * @param latestVersion The latest published version
   * @param registryName The name of the registry (for error messages)
   */
  private static checkVersionConflict(
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
   * Replaces the package name in package.json and jsr.json files with a new name.
   * Uses FileSystemService.replaceInFiles to perform the replacement.
   *
   * @param originalPackageName The original package name to replace
   * @param newPackageName The new package name to use
   */
  private static async replacePackageName(
    originalPackageName: string,
    newPackageName: string
  ): Promise<void> {
    DR.logger.info(`Replacing package name from "${originalPackageName}" to "${newPackageName}"`);

    const rootDir = process.cwd();

    // Replace in package.json and jsr.json files
    await FileSystemService.replaceInFiles({
      searchString: originalPackageName,
      replaceString: newPackageName,
      rootPath: rootDir,
      includePatterns: ['package.json', 'jsr.json'],
      excludePatterns: []
    });

    DR.logger.info(`Successfully replaced package name in configuration files`);
  }

  /**
   * Performs a git reset to discard all changes in the working directory.
   * This is used between alternative package name operations.
   */
  private static async resetGitChanges(): Promise<void> {
    DR.logger.info('Resetting git changes');
    try {
      await execAsync('git reset --hard HEAD');
    } catch (error) {
      DR.logger.error(`Failed to reset git changes: ${ErrorUtils.getErrorString(error)}`);
      throw error;
    }
  }

  /**
   * Publishes the current project to npm.
   *
   * @returns true if the publish was successful, false otherwise.
   */
  private static async publishNpm(): Promise<boolean> {
    DR.logger.info('Running `npm publish --access public`');
    return new Promise((resolve) => {
      const child = spawn('npm publish', ['--access', 'public'], {
        stdio: 'inherit',
        shell: true
      });

      child.on('exit', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }
}
