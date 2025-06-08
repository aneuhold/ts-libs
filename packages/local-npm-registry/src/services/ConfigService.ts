import { DR, FileSystemService } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import path from 'path';
import { DEFAULT_CONFIG, LocalNpmConfig } from '../types/LocalNpmConfig.js';

const CONFIG_FILE_NAME = '.local-npm-registry.json';
export const DATA_DIRECTORY_NAME = '.local-npm-registry';

let cachedConfig: LocalNpmConfig | null = null;
let configFilePath: string | null = null;

/**
 * Service to manage configuration for the local-npm-registry CLI tool.
 */
export class ConfigService {
  /**
   * Finds and loads the configuration file starting from the current working directory
   * and traversing up the directory tree until a configuration file is found.
   */
  static async loadConfig(): Promise<LocalNpmConfig> {
    if (cachedConfig) {
      return cachedConfig;
    }

    // Search for config file starting from current directory
    configFilePath = await FileSystemService.findFileUpTree(
      process.cwd(),
      CONFIG_FILE_NAME
    );

    let config: LocalNpmConfig = {};

    if (configFilePath) {
      try {
        config = (await fs.readJson(configFilePath)) as LocalNpmConfig;
      } catch (error) {
        DR.logger.warn(
          `Warning: Failed to parse config file at ${configFilePath}: ${String(error)}`
        );
        DR.logger.info('Using default configuration.');
      }
    }

    // Merge with defaults
    cachedConfig = {
      ...DEFAULT_CONFIG,
      ...config
    };

    return cachedConfig;
  }

  /**
   * Gets the path to the configuration file that was loaded.
   * Returns null if no configuration file was found.
   */
  static getConfigFilePath(): string | null {
    return configFilePath;
  }

  /**
   * Clears the cached configuration, forcing the next call to loadConfig()
   * to re-read the configuration file.
   */
  static clearCache(): void {
    cachedConfig = null;
    configFilePath = null;
  }

  /**
   * Creates a default configuration file in the specified directory.
   *
   * @param directory - The directory where to create the config file
   */
  static async createDefaultConfig(directory: string): Promise<string> {
    const configPath = `${directory}/${CONFIG_FILE_NAME}`;
    const defaultConfig: LocalNpmConfig = {
      ...DEFAULT_CONFIG
    };
    defaultConfig.dataDirectory = directory;

    await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
    return configPath;
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
    return path.join(baseDirectory, DATA_DIRECTORY_NAME);
  }
}
