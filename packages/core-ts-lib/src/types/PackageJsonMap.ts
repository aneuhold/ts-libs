import type { PackageJsonInfo } from './PackageJsonInfo.js';

/**
 * Maps package names to their corresponding PackageJsonInfo objects.
 * Useful for managing multiple package.json files in a monorepo.
 */
export interface PackageJsonMap {
  [packageName: string]: PackageJsonInfo;
}
