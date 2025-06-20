import { access, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { JsonWithVersionProperty } from '../types/JsonWithVersionProperty.js';
import { PackageJson } from '../types/PackageJson.js';
import { PackageJsonMap } from '../types/PackageJsonMap.js';
import { VersionType } from '../types/VersionType.js';
import ErrorUtils from '../utils/ErrorUtils.js';
import { DR } from './DependencyRegistry.js';
import FileSystemService from './FileSystemService/FileSystemService.js';

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
    let rootPackageJsonData: PackageJson;
    try {
      await access(rootPackageJsonPath);
      const rootPackageJsonContent = await readFile(rootPackageJsonPath, 'utf-8');
      rootPackageJsonData = JSON.parse(rootPackageJsonContent) as PackageJson;
    } catch (error) {
      const originalError = ErrorUtils.getErrorString(error);
      throw new Error(
        `No package.json file found in the current directory or it's unreadable. Original error: ${originalError}`
      );
    }

    const rootDependencies = {
      ...rootPackageJsonData.dependencies,
      ...rootPackageJsonData.devDependencies
    };

    const childPackagesData = await this.getChildPackageJsons();

    // Iterate over all child package.json files
    await Promise.all(
      Object.values(childPackagesData).map(async (childPackageInfo) => {
        const { packageJsonContents, packageJsonPath } = childPackageInfo;

        const { dependencies, devDependencies } = packageJsonContents;

        if (dependencies) {
          Object.keys(dependencies).forEach((dependency) => {
            if (rootDependencies[dependency]) {
              dependencies[dependency] = rootDependencies[dependency];
            }
          });
        }

        if (devDependencies) {
          Object.keys(devDependencies).forEach((dependency) => {
            if (rootDependencies[dependency]) {
              devDependencies[dependency] = rootDependencies[dependency];
            }
          });
        }

        // Write the updated package.json file
        await writeFile(packageJsonPath, JSON.stringify(packageJsonContents, null, 2));
      })
    );
  }

  /**
   * Bumps the version of the package.json file in the current
   * working directory.
   *
   * @param versionType The type of version bump (patch, minor, major).
   */
  static async bumpVersion(versionType: VersionType = VersionType.Patch): Promise<void> {
    const bump = (version: string): string => {
      const [major, minor, patch] = version.split('.').map(Number);
      switch (versionType) {
        case VersionType.Major:
          return `${major + 1}.0.0`;
        case VersionType.Minor:
          return `${major}.${minor + 1}.0`;
        case VersionType.Patch:
        default:
          return `${major}.${minor}.${patch + 1}`;
      }
    };

    const updateVersion = async (filePath: string): Promise<void> => {
      try {
        await access(filePath);
      } catch {
        DR.logger.info(`No ${path.basename(filePath)} file found in the current directory.`);
        return;
      }

      try {
        const fileData = JSON.parse(await readFile(filePath, 'utf-8')) as JsonWithVersionProperty;
        const oldVersion = fileData.version;
        const newVersion = bump(oldVersion);
        fileData.version = newVersion;
        await writeFile(filePath, JSON.stringify(fileData, null, 2));
        DR.logger.info(`Bumped ${path.basename(filePath)} from ${oldVersion} to ${newVersion}`);
      } catch (error) {
        const errorString = ErrorUtils.getErrorString(error);
        DR.logger.error(`Failed to update ${path.basename(filePath)}: ${errorString}`);
      }
    };

    const rootDir = process.cwd();
    await updateVersion(path.join(rootDir, 'package.json'));
  }

  /**
   * Retrieves all package.json files from subdirectories, excluding specified folders
   * and the root package.json.
   *
   * @param searchDirectory The directory to start searching from. Can be relative
   * (e.g., "../") or absolute. Defaults to current working directory.
   */
  static async getChildPackageJsons(searchDirectory?: string): Promise<PackageJsonMap> {
    const childPackages: PackageJsonMap = {};
    const baseDir = searchDirectory ? path.resolve(process.cwd(), searchDirectory) : process.cwd();
    const filePaths = await FileSystemService.getAllFilePathsRelative(baseDir);

    // Filter for package.json files in subdirectories
    const packageJsonRelativePaths = filePaths.filter(
      (filePath) =>
        filePath.endsWith('package.json') && // Must be a package.json file
        filePath !== 'package.json' && // Exclude the root package.json
        !filePath.includes('node_modules') &&
        !filePath.includes('dist') &&
        !filePath.includes('build')
    );

    await Promise.all(
      packageJsonRelativePaths.map(async (relativePath) => {
        const fullPath = path.join(baseDir, relativePath);
        try {
          const fileContents = await readFile(fullPath, 'utf-8');
          const packageJsonData = JSON.parse(fileContents) as PackageJson;
          if (packageJsonData.name) {
            childPackages[packageJsonData.name] = {
              packageJsonContents: packageJsonData,
              packageJsonPath: fullPath
            };
          } else {
            DR.logger.info(
              `Package.json at ${fullPath} is missing the 'name' property. It will not be indexed by name.`
            );
          }
        } catch (error) {
          const errorString = ErrorUtils.getErrorString(error);
          DR.logger.error(`Failed to read or parse package.json at ${fullPath}: ${errorString}`);
        }
      })
    );
    return childPackages;
  }
}
