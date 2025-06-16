import { DR, type PackageJson } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import path from 'path';

/**
 * Service for managing package.json files.
 */
export class PackageJsonService {
  /**
   * Reads and validates the package.json file in the specified directory.
   *
   * @param dir - Directory to search for package.json
   * @param requireVersion - Whether to require the version field (default: true for packages being published)
   */
  static async getPackageInfo(
    dir: string = process.cwd(),
    requireVersion: boolean = true
  ): Promise<PackageJson | null> {
    try {
      const packageJsonPath = path.join(dir, 'package.json');
      const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;

      if (!packageJson.name || (requireVersion && !packageJson.version)) {
        if (requireVersion) {
          throw new Error('package.json must contain name and version fields');
        } else {
          throw new Error('package.json must contain name field');
        }
      }

      return packageJson;
    } catch (error) {
      DR.logger.error(`Error reading package.json: ${String(error)}`);
      return null;
    }
  }

  /**
   * Updates a package.json file with a new version for a specific package.
   * Preserves original formatting, indentation, and comments.
   *
   * @param projectPath - Path to the project directory containing package.json
   * @param packageName - Name of the package to update
   * @param version - New version to set
   */
  static async updatePackageVersion(
    projectPath: string,
    packageName: string,
    version: string
  ): Promise<void> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');

      // Read the original file content to preserve formatting
      const originalContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;

      let updatedContent = originalContent;
      let hasUpdates = false;

      // Update the package's own version if this is the package being published
      if (packageJson.name === packageName) {
        const versionRegex = new RegExp(
          `(["']version["']\\s*:\\s*["'])([^"']+)(["'])`,
          'g'
        );
        if (versionRegex.test(originalContent)) {
          updatedContent = updatedContent.replace(
            versionRegex,
            `$1${version}$3`
          );
          hasUpdates = true;
        }
      }

      // Helper function to update dependencies in specific sections
      const updateDependencySection = (sectionName: string): void => {
        const sectionRegex = new RegExp(
          `(["']${sectionName}["']\\s*:\\s*{[^}]*["']${this.escapeRegex(packageName)}["']\\s*:\\s*["'])([^"']+)(["'])`,
          'g'
        );
        if (sectionRegex.test(updatedContent)) {
          updatedContent = updatedContent.replace(
            sectionRegex,
            `$1${version}$3`
          );
          hasUpdates = true;
        }
      };

      // Update dependencies sections
      if (packageJson.dependencies?.[packageName]) {
        updateDependencySection('dependencies');
      }

      if (packageJson.devDependencies?.[packageName]) {
        updateDependencySection('devDependencies');
      }

      if (packageJson.peerDependencies?.[packageName]) {
        updateDependencySection('peerDependencies');
      }

      // Only write if we made updates
      if (hasUpdates) {
        await fs.writeFile(packageJsonPath, updatedContent, 'utf-8');
        DR.logger.info(
          `Updated ${packageName} to ${version} in ${projectPath}`
        );
      } else {
        DR.logger.info(
          `No updates needed for ${packageName} in ${projectPath}`
        );
      }
    } catch (error) {
      DR.logger.error(
        `Error updating package.json in ${projectPath}: ${String(error)}`
      );
      throw error;
    }
  }

  /**
   * Gets the current version specifier for a package from a project's package.json.
   *
   * @param projectPath - Path to the project directory containing package.json
   * @param packageName - Name of the package to find the specifier for
   * @returns The current version specifier or null if not found
   */
  static async getCurrentSpecifier(
    projectPath: string,
    packageName: string
  ): Promise<string | null> {
    const packageInfo = await this.getPackageInfo(projectPath, false);
    if (!packageInfo) {
      return null;
    }

    // Check dependencies
    if (packageInfo.dependencies?.[packageName]) {
      return packageInfo.dependencies[packageName];
    }

    // Check devDependencies
    if (packageInfo.devDependencies?.[packageName]) {
      return packageInfo.devDependencies[packageName];
    }

    // Check peerDependencies
    if (packageInfo.peerDependencies?.[packageName]) {
      return packageInfo.peerDependencies[packageName];
    }

    return null;
  }

  /**
   * Extracts the organization name from a scoped package name.
   *
   * @param packageName The package name (e.g., "@myorg/package-name")
   * @returns The organization name or null if not a scoped package
   */
  static extractOrganization(packageName: string): string | null {
    const orgMatch = packageName.match(/^@([^/]+)\//);
    return orgMatch ? orgMatch[1] : null;
  }

  /**
   * Escapes special regex characters in a string.
   *
   * @param str - String to escape
   */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
