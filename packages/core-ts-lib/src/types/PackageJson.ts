import { JsonWithVersionProperty } from './JsonWithVersionProperty.js';

export interface PackageJson extends JsonWithVersionProperty {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}
