import { Octokit } from 'octokit';
import 'dotenv/config';
import { Logger } from '@aneuhold/core-ts-lib';
import Config from './ConfigDefinition';

export type ConfigEnv = 'local' | 'dev' | 'prod';

/**
 * A class which can be used to load configuration into the ConfigService
 * from a pre-defined location. This requries that a `.env` file exists in the
 * root of the project / machine with a `CONFIG_GITHUB_TOKEN` variable set.
 */
export default class ConfigService {
  static env: ConfigEnv | null = null;

  private static gitHub: Octokit | null = null;

  private static configObject: Config | null = null;

  /**
   * Returns the configuration object that has been loaded in for the current
   * environment.
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
   * Loads configuration from the GitHub repository into the ConfigService.
   */
  static async useConfig(env: ConfigEnv): Promise<void> {
    ConfigService.env = env;
    if (!ConfigService.gitHub) {
      ConfigService.gitHub = ConfigService.getGitHubClient();
    }
    try {
      const result = await ConfigService.gitHub.rest.repos.getContent({
        mediaType: {
          format: 'raw'
        },
        owner: 'aneuhold',
        repo: 'config',
        path: `${env}.jsonc`
      });
      const strippedJson = ConfigService.stripJsonComments(
        result.data as unknown as string
      );
      ConfigService.configObject = JSON.parse(strippedJson);
    } catch (error) {
      Logger.error(`Failed to load ${env}.json, error: ${error}`);
      throw error;
    }
  }

  /**
   * Creates a new GitHub client using `CONFIG_GITHUB_TOKEN` from the
   * local environment or .env file.
   */
  private static getGitHubClient(): Octokit {
    const authToken = process.env.CONFIG_GITHUB_TOKEN;
    if (!authToken) {
      throw new Error(
        'No CONFIG_GITHUB_TOKEN key found in environment variables.'
      );
    }
    return new Octokit({
      auth: authToken
    });
  }

  /**
   * Inserts the provided configuration into the local environment.
   *
   * This may not actually need to happen.
   */
  private static insertPropertiesIntoEnv(config: object) {
    Object.entries(config).forEach(([key, value]) => {
      if (typeof value === 'object') {
        ConfigService.insertPropertiesIntoEnv(value);
      } else {
        process.env[key] = value;
      }
    });
  }

  /**
   * Strips JSON comments from the provided JSON string. Only `//` comments
   * are supported at the moment.
   */
  private static stripJsonComments = (jsonString: string) => {
    const commentRegex = /\/\/(.*)/g;
    return jsonString.replace(commentRegex, '');
  };
}
