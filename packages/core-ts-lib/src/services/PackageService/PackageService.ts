import { DR } from '../DependencyRegistry.js';
import JsrPackageService from './JsrPackageService.js';
import NpmPackageService from './NpmPackageService.js';
import PackageServiceUtils from './PackageServiceUtils.js';

/**
 * A service which can be used to assist in publishing or validating packages
 * for the current project. This service provides convenient aliases to the
 * specialized JSR and NPM package services.
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
    return JsrPackageService.validatePublish(alternativePackageNames);
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
    return JsrPackageService.publish(alternativePackageNames);
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
    return NpmPackageService.validatePublish(alternativePackageNames);
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
    return NpmPackageService.publish(alternativePackageNames);
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

    await PackageServiceUtils.replacePackageName(originalString, newString);

    DR.logger.info('Test completed - package name replacement has been applied');
  }

  /**
   * Initializes a changelog for the current project if one doesn't exist.
   * This operation is idempotent - it won't modify existing content.
   *
   * @param packagePath Optional path to the package directory (defaults to current working directory)
   */
  static async initializeChangelog(packagePath?: string): Promise<void> {
    return PackageServiceUtils.initializeChangelog(packagePath);
  }
}
