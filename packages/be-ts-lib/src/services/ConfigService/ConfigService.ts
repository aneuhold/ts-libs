import { DR } from '@aneuhold/core-ts-lib';
import 'dotenv/config';
import { parse } from 'jsonc-parser';
import GitHubService from '../GitHubService.js';
import Config from './ConfigDefinition.js';

export type ConfigEnv = 'local' | 'dev' | 'prod';

/**
 * Service for managing configuration settings.
 *
 * The {@link ConfigService} class provides methods to load and access configuration
 * settings from a GitHub repository. It ensures that the configuration is loaded
 * and available for the current environment.
 *
 * This requires that a `.env` file exists in the
 * root of the project / machine with a `CONFIG_GITHUB_TOKEN` variable set.
 */
export default class ConfigService {
  /**
   * The current environment configuration.
   */
  static env: ConfigEnv | null = null;

  private static configObject: Config | null = null;

  /**
   * Returns the configuration object that has been loaded in for the current
   * environment.
   *
   * @throws {Error} If the {@link ConfigService} has not been initialized.
   * @returns The configuration object for the current environment.
   */
  static get config(): Config {
    if (!ConfigService.configObject) {
      throw new Error(
        'ConfigService has not been initialized yet. Use ConfigService.useConfig() to initialize it.'
      );
    }
    return ConfigService.configObject;
  }

  /**
   * Checks if the {@link ConfigService} has been initialized.
   *
   * @returns True if the {@link ConfigService} has been initialized, false otherwise.
   */
  static get isInitialized(): boolean {
    return !!ConfigService.configObject;
  }

  /**
   * Loads configuration from the GitHub repository into the {@link ConfigService}.
   *
   * @param env - The environment for which to load the configuration.
   * @throws {Error} If the configuration fails to load.
   */
  static async useConfig(env: ConfigEnv): Promise<void> {
    ConfigService.env = env;
    try {
      const jsonString = await GitHubService.getContentFromRepo(
        'config',
        `${env}.jsonc`
      );
      ConfigService.configObject = parse(jsonString) as Config;
    } catch (error) {
      DR.logger.error(`Failed to load ${env}.json, error: ${error as string}`);
      throw error;
    }
  }

  /**
   * Inserts the provided configuration into the local environment.
   *
   * This may not actually need to happen.
   *
   * @param config - The configuration object to insert into the environment.
   */
  private static insertPropertiesIntoEnv(config: object) {
    Object.entries(config).forEach(([key, value]) => {
      if (typeof value === 'object') {
        ConfigService.insertPropertiesIntoEnv(value as object);
      } else {
        process.env[key] = value as string;
      }
    });
  }
}
