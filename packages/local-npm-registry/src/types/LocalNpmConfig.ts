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
};

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: Required<LocalNpmConfig> = {
  storeLocation: os.homedir()
};
