import { exec, spawn } from 'child_process';
import { access, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { JsonWithVersionProperty } from '../../types/JsonWithVersionProperty.js';
import { PackageJson } from '../../types/PackageJson.js';
import ErrorUtils from '../../utils/ErrorUtils.js';
import { DR } from '../DependencyRegistry.js';
import PackageServiceUtils from './PackageServiceUtils.js';

const execAsync = promisify(exec);

/**
 * Service for handling JSR-specific package operations including validation and publishing.
 */
export default class JsrPackageService {
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
  static async validatePublish(alternativePackageNames?: string[]): Promise<void> {
    const { packageName: originalPackageName, version: currentVersion } =
      await PackageServiceUtils.getPackageInfo();

    await PackageServiceUtils.validatePrePublishRequirements(currentVersion);

    const packageNamesToValidate = [originalPackageName, ...(alternativePackageNames || [])];

    for (const packageName of packageNamesToValidate) {
      const isAlternativeName = packageName !== originalPackageName;

      DR.logger.info(`Validating JSR publishing for package: ${packageName}`);

      if (isAlternativeName) {
        await PackageServiceUtils.replacePackageName(originalPackageName, packageName);
      }

      await PackageServiceUtils.replaceMonorepoImportsWithNpmSpecifiers();
      const { version } = await JsrPackageService.updateJsrFromPackageJson();
      const successfulDryRun = await JsrPackageService.publishDryRun(packageName, version);

      await PackageServiceUtils.resetGitChanges();

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
  static async publish(alternativePackageNames?: string[]): Promise<void> {
    const { packageName: originalPackageName } = await PackageServiceUtils.getPackageInfo();

    await PackageServiceUtils.validatePrePublishRequirements(
      (await PackageServiceUtils.getPackageInfo()).version
    );

    const packageNamesToPublish = [originalPackageName, ...(alternativePackageNames || [])];

    for (const packageName of packageNamesToPublish) {
      const isAlternativeName = packageName !== originalPackageName;

      DR.logger.info(`Publishing to JSR for package: ${packageName}`);

      if (isAlternativeName) {
        await PackageServiceUtils.replacePackageName(originalPackageName, packageName);
      }

      await PackageServiceUtils.replaceMonorepoImportsWithNpmSpecifiers();
      await JsrPackageService.updateJsrFromPackageJson();
      const result = await JsrPackageService.publishToJsr();

      await PackageServiceUtils.resetGitChanges();

      if (!result) {
        process.exit(1);
      }
    }

    DR.logger.success('Successfully published to JSR for all package names.');
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
      const { packageName, version } = await PackageServiceUtils.getPackageInfo();
      const packageJsonData = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as PackageJson;
      const jsrJsonData = JSON.parse(
        await readFile(jsrJsonPath, 'utf-8')
      ) as JsonWithVersionProperty;

      // Update JSR version
      jsrJsonData.version = version;

      // Resolve wildcard dependencies in package.json for JSR compatibility
      await PackageServiceUtils.resolveWildcardDependenciesInPackageJson(
        packageJsonData,
        packageJsonPath
      );

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
   * Executes a dry run of JSR publishing. Returns true if the dry run was
   * successful, false otherwise. Also checks for existing versions on JSR
   * and throws an error if the current version already exists or if a higher
   * version is already published.
   *
   * @param packageName The package name from jsr.json
   * @param currentVersion The current version from package.json
   */
  private static async publishDryRun(
    packageName: string,
    currentVersion: string
  ): Promise<boolean> {
    // Check for existing versions on JSR first
    await JsrPackageService.checkVersionConflicts(packageName, currentVersion);

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
  private static async publishToJsr(): Promise<boolean> {
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
   * Checks for version conflicts on JSR by looking up the current package
   * and comparing versions. Throws an error if the current version already
   * exists or if a higher version is already published.
   *
   * @param packageName The package name from jsr.json
   * @param currentVersion The current version from package.json
   */
  private static async checkVersionConflicts(
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

        PackageServiceUtils.checkVersionConflict(currentVersion, latestVersion, 'JSR');
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
}
