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
 * Type guard that checks whether an unknown value matches the {@link PackageJson} shape.
 *
 * @param value The value to narrow.
 */
export const isPackageJson = (value: unknown): value is PackageJson =>
  isJsonWithVersionProperty(value) && 'name' in value && typeof value.name === 'string';
