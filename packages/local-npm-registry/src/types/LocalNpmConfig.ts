import os from 'os';

/**
 * Configuration interface for the local-npm-registry CLI tool.
 */
export type LocalNpmConfig = {
  /**
   * The base directory where all local-npm-registry data should be stored.
   * If not specified, defaults to the user's home directory.
   *
   * A '.local-npm-registry' subdirectory will be created within this directory
   * to store all package store files, lock files, and Verdaccio data.
   */
  dataDirectory?: string;

  /**
   * The port on which the local Verdaccio registry will run.
   * If not specified, defaults to 4873.
   */
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
  dataDirectory: os.homedir(),
  registryPort: 4873,
  registryUrl: 'http://localhost:4873',
  verdaccioConfig: {}
};
