import { access, readFile, writeFile } from 'fs/promises';
import path from 'path';
import FileSystemService from './FileSystemService/FileSystemService';

/**
 * A service which can be used to manage dependencies in the current project
 * in various ways.
 */
export default class DependencyService {
  /**
   * Updates the package.json files of all sub-directories based on the root
   * package.json file. This will match any versions of dependencies in the
   * sub-directories to the version in the root package.json file.
   */
  static async updateChildPackageJsons(): Promise<void> {
    // Read the root package.json file
    const rootPackageJsonPath = path.join(process.cwd(), 'package.json');
    try {
      await access(rootPackageJsonPath);
    } catch {
      throw new Error('No package.json file found in the current directory.');
    }
    const rootPackageJsonData = JSON.parse(
      await readFile(rootPackageJsonPath, 'utf-8')
    );

    // Get all files and in the current directory
    const filePaths = await FileSystemService.getAllFilePathsRelative(
      process.cwd()
    );
    const packageJsonPaths = filePaths.filter(
      (filePath) =>
        !filePath.includes('node_modules') &&
        !filePath.includes('dist') &&
        !filePath.includes('build') &&
        filePath !== '/package.json' &&
        filePath.endsWith('package.json')
    );

    const rootDependencies = {
      ...rootPackageJsonData.dependencies,
      ...rootPackageJsonData.devDependencies
    };

    // Iterate over all package.json files
    await Promise.all(
      packageJsonPaths.map(async (packageJsonPath) => {
        const fullPackageJsonPath = path.join(process.cwd(), packageJsonPath);
        const packageJsonData = JSON.parse(
          await readFile(fullPackageJsonPath, 'utf-8')
        );

        if (packageJsonData.dependencies) {
          Object.keys(packageJsonData.dependencies).forEach((dependency) => {
            if (rootDependencies[dependency]) {
              packageJsonData.dependencies[dependency] =
                rootDependencies[dependency];
            }
          });
        }
        if (packageJsonData.devDependencies) {
          Object.keys(packageJsonData.devDependencies).forEach((dependency) => {
            if (rootDependencies[dependency]) {
              packageJsonData.dependencies[dependency] =
                rootDependencies[dependency];
            }
          });
        }

        // Write the updated package.json file
        await writeFile(
          fullPackageJsonPath,
          JSON.stringify(packageJsonData, null, 2)
        );
      })
    );
  }
}
