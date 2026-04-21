import type { JsonWithVersionProperty } from './JsonWithVersionProperty.js';
import { isJsonWithVersionProperty } from './JsonWithVersionProperty.js';

/**
 * Represents the contents of a `package.json` file, including dependencies and metadata.
 * Extends JsonWithVersionProperty for version tracking.
 */
export interface PackageJson extends JsonWithVersionProperty {
  name: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/**
 * A {@link PackageJson} that is guaranteed to have a `name` but may or may not
 * have a `version`. Useful for callers that are reading a `package.json` where
 * the version field is not required (e.g. during pre-publish setup).
 */
export type PackageJsonWithoutVersion = Omit<PackageJson, 'version'> & {
  version?: string;
};

/**
 * Type guard that checks whether an unknown value matches the {@link PackageJson} shape.
 *
 * @param value The value to narrow.
 */
export const isPackageJson = (value: unknown): value is PackageJson =>
  isJsonWithVersionProperty(value) && 'name' in value && typeof value.name === 'string';

/**
 * Type guard that checks whether an unknown value matches the
 * {@link PackageJsonWithoutVersion} shape, i.e. has a `name` property but
 * may not have a `version` property.
 *
 * @param value The value to narrow.
 */
export const isPackageJsonWithoutVersion = (value: unknown): value is PackageJsonWithoutVersion =>
  typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string';
