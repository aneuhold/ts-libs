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
   */
  static async getPackageInfo(
    dir: string = process.cwd()
  ): Promise<PackageJson | null> {
    try {
      const packageJsonPath = path.join(dir, 'package.json');
      const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;

      if (!packageJson.name || !packageJson.version) {
        throw new Error('package.json must contain name and version fields');
      }

      return packageJson;
    } catch (error) {
      DR.logger.error(`Error reading package.json: ${String(error)}`);
      return null;
    }
  }

  /**
   * Updates a package.json file with a new version for a specific package.
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
      const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;

      // Update the package's own version if this is the package being published
      if (packageJson.name === packageName) {
        packageJson.version = version;
      }

      // Update dependencies
      if (packageJson.dependencies?.[packageName]) {
        packageJson.dependencies[packageName] = version;
      }

      // Update devDependencies
      if (packageJson.devDependencies?.[packageName]) {
        packageJson.devDependencies[packageName] = version;
      }

      // Update peerDependencies
      if (packageJson.peerDependencies?.[packageName]) {
        packageJson.peerDependencies[packageName] = version;
      }

      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      DR.logger.info(`Updated ${packageName} to ${version} in ${projectPath}`);
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
    const packageInfo = await this.getPackageInfo(projectPath);
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
}
