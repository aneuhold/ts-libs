import fs from 'fs-extra';
import path from 'path';

/**
 * Utility service for various package managers.
 */
export class PackageManagerService {
  /**
   * Determines the package manager to use based on lock files in the specified directory.
   *
   * @param projectPath - Path to the project directory to check
   */
  static async detectPackageManager(projectPath: string): Promise<string> {
    // Check for lock files in order of preference
    if (await fs.pathExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }

    if (await fs.pathExists(path.join(projectPath, 'yarn.lock'))) {
      return 'yarn';
    }

    if (await fs.pathExists(path.join(projectPath, 'package-lock.json'))) {
      return 'npm';
    }

    // Default to npm if no lock file is found
    return 'npm';
  }
}
