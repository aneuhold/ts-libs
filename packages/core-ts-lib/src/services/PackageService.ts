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
   */
  static async validateJsrPublish(): Promise<void> {
    if (await FileSystemService.hasPendingChanges()) {
      DR.logger.error('Please commit or stash your changes before publishing.');
      process.exit(1);
    }
    await PackageService.replaceMonorepoImportsWithNpmSpecifiers();
    await PackageService.updateJsrFromPackageJson();
    const successfulDryRun = await PackageService.publishJsrDryRun();
    await PackageService.revertGitChanges();

    if (!successfulDryRun) {
      process.exit(1);
    } else {
      DR.logger.success('Successfully validated JSR publishing.');
    }
  }

  static async publishToJsr(): Promise<void> {
    if (await FileSystemService.hasPendingChanges()) {
      DR.logger.error('Please commit or stash your changes before publishing.');
      process.exit(1);
    }
    await PackageService.replaceMonorepoImportsWithNpmSpecifiers();
    await PackageService.updateJsrFromPackageJson();
    const result = await PackageService.publishJsr();
    await PackageService.revertGitChanges();

    if (!result) {
      process.exit(1);
    } else {
      DR.logger.success('Successfully published to JSR.');
    }
  }

  /**
   * Updates the jsr.json file from the package.json file and resolves wildcard
   * dependencies in package.json for JSR compatibility.
   */
  private static async updateJsrFromPackageJson(): Promise<void> {
    const rootDir = process.cwd();
    const packageJsonPath = path.join(rootDir, 'package.json');
    const jsrJsonPath = path.join(rootDir, 'jsr.json');

    try {
      await access(packageJsonPath);
    } catch {
      DR.logger.error('No package.json file found in the current directory.');
      return;
    }

    try {
      await access(jsrJsonPath);
    } catch {
      DR.logger.error('No jsr.json file found in the current directory.');
      return;
    }

    try {
      const packageJsonData = JSON.parse(
        await readFile(packageJsonPath, 'utf-8')
      ) as PackageJson;
      const jsrJsonData = JSON.parse(
        await readFile(jsrJsonPath, 'utf-8')
      ) as JsonWithVersionProperty;

      // Update JSR version
      jsrJsonData.version = packageJsonData.version;

      // Resolve wildcard dependencies in package.json for JSR compatibility
      await this.resolveWildcardDependenciesInPackageJson(
        packageJsonData,
        packageJsonPath
      );

      await writeFile(jsrJsonPath, JSON.stringify(jsrJsonData, null, 2));
      DR.logger.info(
        'Updated jsr.json from package.json to version ' + jsrJsonData.version
      );
    } catch (error) {
      const errorString = ErrorUtils.getErrorString(error);
      DR.logger.error(
        `Failed to update jsr.json from package.json: ${errorString}`
      );
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
      const resolveDependencies = (
        deps: Record<string, string> | undefined
      ): void => {
        if (!deps) return;

        for (const [depName, depVersion] of Object.entries(deps)) {
          if (depVersion === '*' && depName in childPackages) {
            // Replace wildcard with "*" + actual version from the monorepo
            deps[depName] =
              `*${childPackages[depName].packageJsonContents.version}`;
          }
        }
      };

      // Resolve each dependency type
      resolveDependencies(packageJsonData.dependencies);
      resolveDependencies(packageJsonData.devDependencies);
      resolveDependencies(packageJsonData.peerDependencies);
      resolveDependencies(packageJsonData.optionalDependencies);

      // Write the updated package.json
      await writeFile(
        packageJsonPath,
        JSON.stringify(packageJsonData, null, 2)
      );

      DR.logger.info(
        'Resolved wildcard dependencies in package.json for JSR compatibility'
      );
    } catch (error) {
      const errorString = ErrorUtils.getErrorString(error);
      DR.logger.error(
        `Failed to resolve wildcard dependencies: ${errorString}`
      );
      throw error;
    }
  }

  /**
   * Executes a dry run of JSR publishing. Returns true if the dry run was
   * successful, false otherwise.
   */
  private static async publishJsrDryRun(): Promise<boolean> {
    DR.logger.info('Running `jsr publish --dry-run`');
    try {
      const { stdout, stderr } = await execAsync(
        'jsr publish --allow-dirty --dry-run'
      );
      if (stderr) {
        DR.logger.info(stderr);
      }
      DR.logger.info(stdout);
    } catch (error) {
      DR.logger.error(
        `Failed to run 'jsr publish --dry-run': ${ErrorUtils.getErrorString(error)}`
      );
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
      .filter(
        (filePath) => filePath.endsWith('.ts') && !filePath.endsWith('.spec.ts')
      )
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
        DR.logger.error(
          `Failed to process file ${filePath}: ${ErrorUtils.getErrorString(error)}`
        );
      }
    }

    DR.logger.info(
      `Completed monorepo import replacement: ${totalReplacements} total replacements made`
    );
  }

  private static async revertGitChanges(): Promise<void> {
    DR.logger.info(
      'Reverting changes made to jsr.json, package.json, and source files'
    );
    try {
      await execAsync('git checkout -- jsr.json package.json src/');
    } catch (error) {
      DR.logger.error(
        `Failed to revert changes: ${ErrorUtils.getErrorString(error)}`
      );
    }
  }
}
