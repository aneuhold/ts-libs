import type { JsonWithVersionProperty } from './JsonWithVersionProperty.js';

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
