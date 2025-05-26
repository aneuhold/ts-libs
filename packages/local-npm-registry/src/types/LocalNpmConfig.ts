import os from 'os';
import { WatchConfig } from './WatchConfig.js';

/**
 * Configuration interface for the local-npm-registry CLI tool.
 */
export type LocalNpmConfig = {
  /**
   * The directory where the local package store file should be located.
   * If not specified, defaults to the user's home directory.
   */
  storeLocation?: string;

  /**
   * Configuration for the watch & local publishing system.
   */
  watch?: WatchConfig;
};

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: Required<LocalNpmConfig> = {
  storeLocation: os.homedir(),
  watch: {
    watchedPackages: [],
    registryPort: 4873,
    registryUrl: 'http://localhost:4873',
    autoStartRegistry: true,
    verdaccioConfig: {}
  }
};
