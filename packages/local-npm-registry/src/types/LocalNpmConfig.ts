import os from 'os';

/**
 * Configuration interface for the local-npm-registry CLI tool.
 */
export type LocalNpmConfig = {
  /**
   * The directory where the local package store file should be located.
   * If not specified, defaults to the user's home directory.
   */
  storeLocation?: string;

  registryPort?: number;

  /**
   * The URL of the local Verdaccio registry.
   * If not specified, defaults to 'http://localhost:4873'.
   */
  registryUrl?: string;

  /**
   * Configuration for verdaccio. This will override the default Verdaccio configuration.
   * If not specified, defaults to an empty object.
   */
  verdaccioConfig?: Record<string, unknown>;
};

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: Required<LocalNpmConfig> = {
  storeLocation: os.homedir(),
  registryPort: 4873,
  registryUrl: 'http://localhost:4873',
  verdaccioConfig: {}
};
