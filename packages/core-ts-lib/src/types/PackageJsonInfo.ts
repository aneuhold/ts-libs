import type { PackageJson } from './PackageJson.js';

/**
 * Contains the parsed contents and file path of a package.json file.
 * Used for package metadata management.
 */
export interface PackageJsonInfo {
  packageJsonContents: PackageJson;
  packageJsonPath: string;
}
