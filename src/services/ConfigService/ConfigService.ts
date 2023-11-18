import { Octokit } from 'octokit';
import 'dotenv/config';
import Logger from '../../utils/Logger';

export type ConfigEnv = 'local' | 'dev' | 'prod';

/**
 * A class which can be used to load configuration into the local environment
 * from a pre-defined location.
 */
export default class ConfigService {
  private static gitHub: Octokit | null = null;

  static async useConfig(env: string): Promise<void> {
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
      console.log('strippedJson', strippedJson);
      const config = JSON.parse(strippedJson);
      console.log(config);
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
   * Strips JSON comments from the provided JSON string. Only `//` comments
   * are supported at the moment.
   */
  private static stripJsonComments = (jsonString: string) => {
    const commentRegex = /\/\/(.*)/g;
    return jsonString.replace(commentRegex, '');
  };
}
