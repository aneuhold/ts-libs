import { PackageJsonInfo } from './PackageJsonInfo.js';

export interface PackageJsonMap {
  [packageName: string]: PackageJsonInfo;
}
