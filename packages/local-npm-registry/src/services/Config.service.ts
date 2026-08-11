import { DR, FileSystemService } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import path from 'path';
import type { LocalNpmConfig } from '../types/LocalNpmConfig.js';
import { DEFAULT_CONFIG } from '../types/LocalNpmConfig.js';

/**
 * Service to manage configuration for the local-npm-registry CLI tool.
 */
export class ConfigService {
  static readonly #CONFIG_FILE_NAME = '.local-npm-registry.json';

  static readonly DATA_DIRECTORY_NAME = '.local-npm-registry';

  static #cachedConfig: LocalNpmConfig | null = null;

  static #configFilePath: string | null = null;

  /**
   * Finds and loads the configuration file starting from the current working directory
   * and traversing up the directory tree until a configuration file is found.
   */
  static async loadConfig(): Promise<LocalNpmConfig> {
    if (ConfigService.#cachedConfig) {
      return ConfigService.#cachedConfig;
    }

    // Search for config file starting from current directory
    ConfigService.#configFilePath = await FileSystemService.findFileUpTree(
      process.cwd(),
      ConfigService.#CONFIG_FILE_NAME
    );

    let config: LocalNpmConfig = {};

    if (ConfigService.#configFilePath) {
      try {
        // `fs.readJson` returns `unknown`. The structural shape of
        // `LocalNpmConfig` is just "an object with optional fields", so any
        // guard would only check `typeof === 'object'` — which provides no
        // real signal. Trust the file contents and merge with defaults.
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        config = (await fs.readJson(ConfigService.#configFilePath)) as LocalNpmConfig;
      } catch (error) {
        DR.logger.warn(
          `Warning: Failed to parse config file at ${ConfigService.#configFilePath}: ${String(error)}`
        );
        DR.logger.info('Using default configuration.');
      }
    }

    // Merge with defaults
    ConfigService.#cachedConfig = {
      ...DEFAULT_CONFIG,
      ...config
    };

    return ConfigService.#cachedConfig;
  }

  /**
   * Gets the path to the configuration file that was loaded.
   * Returns null if no configuration file was found.
   */
  static getConfigFilePath(): string | null {
    return ConfigService.#configFilePath;
  }

  /**
   * Clears the cached configuration, forcing the next call to loadConfig()
   * to re-read the configuration file.
   */
  static clearCache(): void {
    ConfigService.#cachedConfig = null;
    ConfigService.#configFilePath = null;
  }

  /**
   * Creates a default configuration file in the specified directory.
   *
   * @param directory - The directory where to create the config file
   */
  static async createDefaultConfig(directory: string): Promise<string> {
    const configPath = `${directory}/${ConfigService.#CONFIG_FILE_NAME}`;
    const defaultConfig: LocalNpmConfig = {
      ...DEFAULT_CONFIG
    };
    defaultConfig.dataDirectory = directory;

    await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
    return configPath;
  }

  /**
   * Gets the URL of the local registry, which is where packages are published
   * to and resolved from.
   */
  static async getLocalRegistryUrl(): Promise<string> {
    const config = await ConfigService.loadConfig();
    return config.registryUrl || DEFAULT_CONFIG.registryUrl;
  }

  /**
   * Gets the path to the data directory where local-npm-registry stores its data.
   * This is typically a subdirectory of the configured data directory.
   *
   * @returns The full path to the data directory.
   */
  static async getDataDirectoryPath(): Promise<string> {
    const config = await ConfigService.loadConfig();
    const baseDirectory = config.dataDirectory || DEFAULT_CONFIG.dataDirectory;
    return path.join(baseDirectory, ConfigService.DATA_DIRECTORY_NAME);
  }
}
