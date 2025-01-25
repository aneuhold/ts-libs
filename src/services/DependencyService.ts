import { access, readFile, writeFile } from 'fs/promises';
import path from 'path';
import ErrorUtils from '../utils/ErrorUtils.js';
import Logger from '../utils/Logger.js';
import FileSystemService from './FileSystemService/FileSystemService.js';

export interface PackageJson extends JsonWithVersionProperty {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface JsonWithVersionProperty {
  version: string;
}

/**
 * Standard Semantic Versioning bump types.
 */
export enum VersionType {
  Patch = 'patch',
  Minor = 'minor',
  Major = 'major'
}

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
    ) as PackageJson;

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
        ) as PackageJson;

        const dependencies = packageJsonData.dependencies;
        if (dependencies) {
          Object.keys(dependencies).forEach((dependency) => {
            if (rootDependencies[dependency]) {
              dependencies[dependency] = rootDependencies[dependency];
            }
          });
        }
        const devDependencies = packageJsonData.devDependencies;
        if (devDependencies) {
          Object.keys(devDependencies).forEach((dependency) => {
            if (rootDependencies[dependency]) {
              devDependencies[dependency] = rootDependencies[dependency];
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

  /**
   * Bumps the version of the package.json and jsr.json files in the current
   * working directory.
   *
   * @param versionType The type of version bump (patch, minor, major).
   */
  static async bumpVersion(
    versionType: VersionType = VersionType.Patch
  ): Promise<void> {
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
        Logger.info(
          `No ${path.basename(filePath)} file found in the current directory.`
        );
        return;
      }

      try {
        const fileData = JSON.parse(
          await readFile(filePath, 'utf-8')
        ) as JsonWithVersionProperty;
        const oldVersion = fileData.version;
        const newVersion = bump(oldVersion);
        fileData.version = newVersion;
        await writeFile(filePath, JSON.stringify(fileData, null, 2));
        Logger.info(
          `Bumped ${path.basename(filePath)} from ${oldVersion} to ${newVersion}`
        );
      } catch (error) {
        const errorString = ErrorUtils.getErrorString(error);
        Logger.error(
          `Failed to update ${path.basename(filePath)}: ${errorString}`
        );
      }
    };

    const rootDir = process.cwd();
    await updateVersion(path.join(rootDir, 'package.json'));
    await updateVersion(path.join(rootDir, 'jsr.json'));
  }
}
