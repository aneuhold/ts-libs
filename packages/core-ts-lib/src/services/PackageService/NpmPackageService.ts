import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import ErrorUtils from '../../utils/ErrorUtils.js';
import { DR } from '../DependencyRegistry.js';
import PackageServiceUtils from './PackageServiceUtils.js';

const execAsync = promisify(exec);

/**
 * Service for handling NPM-specific package operations including validation and publishing.
 */
export default class NpmPackageService {
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
  static async validatePublish(alternativePackageNames?: string[]): Promise<void> {
    const { packageName: originalPackageName, version: currentVersion } =
      await PackageServiceUtils.getPackageInfo();

    await PackageServiceUtils.validatePrePublishRequirements(currentVersion);

    const packageNamesToValidate = [originalPackageName, ...(alternativePackageNames || [])];

    for (const packageName of packageNamesToValidate) {
      const isAlternativeName = packageName !== originalPackageName;

      DR.logger.info(`Validating npm publishing for package: ${packageName}`);

      if (isAlternativeName) {
        await PackageServiceUtils.replacePackageName(originalPackageName, packageName);
      }

      const successfulDryRun = await NpmPackageService.publishDryRun();
      if (!successfulDryRun) {
        if (isAlternativeName) {
          await PackageServiceUtils.resetGitChanges();
        }
        process.exit(1);
      }

      await NpmPackageService.checkVersionConflicts(packageName, currentVersion);

      if (isAlternativeName) {
        await PackageServiceUtils.resetGitChanges();
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
  static async publish(alternativePackageNames?: string[]): Promise<void> {
    const { packageName: originalPackageName } = await PackageServiceUtils.getPackageInfo();

    await PackageServiceUtils.validatePrePublishRequirements(
      (await PackageServiceUtils.getPackageInfo()).version
    );

    const packageNamesToPublish = [originalPackageName, ...(alternativePackageNames || [])];

    for (const packageName of packageNamesToPublish) {
      const isAlternativeName = packageName !== originalPackageName;

      DR.logger.info(`Publishing to npm for package: ${packageName}`);

      if (isAlternativeName) {
        await PackageServiceUtils.replacePackageName(originalPackageName, packageName);
      }

      const result = await NpmPackageService.publishToNpm();

      if (isAlternativeName) {
        await PackageServiceUtils.resetGitChanges();
      }

      if (!result) {
        process.exit(1);
      }
    }

    DR.logger.success('Successfully published to npm for all package names.');
  }

  /**
   * Executes a dry run of npm publishing.
   *
   * @returns true if the dry run was successful, false otherwise.
   */
  private static async publishDryRun(): Promise<boolean> {
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
  private static async checkVersionConflicts(
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
        PackageServiceUtils.checkVersionConflict(currentVersion, latestVersion, 'npm');
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
   * Publishes the current project to npm.
   *
   * @returns true if the publish was successful, false otherwise.
   */
  private static async publishToNpm(): Promise<boolean> {
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
