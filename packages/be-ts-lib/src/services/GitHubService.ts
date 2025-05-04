import { DR } from '@aneuhold/core-ts-lib';
import 'dotenv/config';
import { Octokit } from 'octokit';

export type ConfigEnv = 'local' | 'dev' | 'prod';

/**
 * A class which can be used to interact with GitHub.
 */
export default class GitHubService {
  private static gitHub: Octokit | null = null;

  /**
   * Retrieves the content of a file from a specified GitHub repository.
   *
   * @param repoName - The name of the repository.
   * @param filePath - The path to the file within the repository.
   * @returns The content of the file as a string.
   * @throws Will throw an error if the content cannot be retrieved.
   */
  static async getContentFromRepo(
    repoName: string,
    filePath: string
  ): Promise<string> {
    if (!GitHubService.gitHub) {
      GitHubService.gitHub = GitHubService.getGitHubClient();
    }
    try {
      const result = await GitHubService.gitHub.rest.repos.getContent({
        mediaType: {
          format: 'raw'
        },
        owner: 'aneuhold',
        repo: repoName,
        path: filePath
      });
      return result.data as unknown as string;
    } catch (error) {
      DR.logger.error(
        `Failed to load ${filePath} from ${repoName}, error: ${error as string}`
      );
      throw error;
    }
  }

  /**
   * Creates a new GitHub client using `CONFIG_GITHUB_TOKEN` from the
   * local environment or .env file.
   *
   * @returns A new GitHub client.
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
}
