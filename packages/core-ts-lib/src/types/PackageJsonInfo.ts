import { PackageJson } from './PackageJson.js';

/**
 * Contains the parsed contents and file path of a package.json file.
 * Used for package metadata management.
 *
 * @param packageJsonContents The parsed package.json object
 * @param packageJsonPath The absolute path to the package.json file
 */
export interface PackageJsonInfo {
  packageJsonContents: PackageJson;
  packageJsonPath: string;
}
