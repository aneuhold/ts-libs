import { execSync } from 'child_process';
import ErrorUtils from '../../utils/ErrorUtils.js';
import { DR } from '../DependencyRegistry.js';

/**
 * Service for handling Git tag operations related to changelog management.
 */
export default class GitTagService {
  /**
   * Gets Git tags for a specific package.
   *
   * @param packageName The package name
   * @param workingDir The working directory
   * @returns Array of Git tags for the package
   */
  static getPackageTags(packageName: string, workingDir: string): string[] {
    try {
      // Convert package name to tag prefix (remove scope if present)
      const tagPrefix = this.getTagPrefix(packageName);
      const tagPattern = `${tagPrefix}-v*`;

      // Get all tags matching the pattern
      const output = execSync(`git tag -l "${tagPattern}"`, {
        cwd: workingDir,
        encoding: 'utf-8'
      });

      return output
        .trim()
        .split('\n')
        .filter((tag) => tag.length > 0);
    } catch (error) {
      // If git command fails (e.g., not a git repo), return empty array
      DR.logger.warn(`Failed to retrieve Git tags: ${ErrorUtils.getErrorString(error)}`);
      return [];
    }
  }

  /**
   * Generates the expected Git tag name for a package version.
   *
   * @param packageName The package name
   * @param version The version
   * @returns The expected Git tag name
   */
  static getTagName(packageName: string, version: string): string {
    const tagPrefix = this.getTagPrefix(packageName);
    return `${tagPrefix}-v${version}`;
  }

  /**
   * Converts package name to tag prefix (removes scope if present).
   *
   * @param packageName The package name
   * @returns The tag prefix
   */
  private static getTagPrefix(packageName: string): string {
    return packageName.replace(/^@[\w-]+\//, '');
  }
}
