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
  static async updateJsrFromPackageJson(): Promise<void> {
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
   * version constraints (e.g., "*1.2.3") for JSR compatibility.
   *
   * @param packageJsonData The package.json data to modify
   * @param packageJsonPath The path to the package.json file
   */
  private static async resolveWildcardDependenciesInPackageJson(
    packageJsonData: PackageJson,
    packageJsonPath: string
  ): Promise<void> {
    try {
      // Get all child packages to resolve wildcard dependencies
      const childPackages = await DependencyService.getChildPackageJsons();

      // Helper function to resolve dependencies
      const resolveDependencies = (
        deps: Record<string, string> | undefined
      ): void => {
        if (!deps) return;

        for (const [depName, depVersion] of Object.entries(deps)) {
          if (depVersion === '*' && depName in childPackages) {
            // Replace wildcard with "^" + actual version from the monorepo
            deps[depName] =
              `^${childPackages[depName].packageJsonContents.version}`;
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

  private static async revertGitChanges(): Promise<void> {
    DR.logger.info('Reverting changes made to jsr.json and package.json');
    try {
      await execAsync('git checkout jsr.json package.json');
    } catch (error) {
      DR.logger.error(
        `Failed to revert changes made to jsr.json and package.json: ${ErrorUtils.getErrorString(error)}`
      );
    }
  }
}
