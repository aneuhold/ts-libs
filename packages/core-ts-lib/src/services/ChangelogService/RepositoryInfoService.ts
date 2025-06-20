import { readFile } from 'fs/promises';
import path from 'path';
import type { RepositoryInfo } from './types.js';

/**
 * Service for extracting repository information from package.json files.
 */
export default class RepositoryInfoService {
  /**
   * Extracts repository information from package.json
   *
   * @param packagePath Path to the package directory
   * @returns Repository information or null if not found/invalid
   */
  static async getRepositoryInfo(packagePath?: string): Promise<RepositoryInfo | null> {
    const workingDir = packagePath || process.cwd();
    const packageJsonPath = path.join(workingDir, 'package.json');

    try {
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent) as unknown;

      // Type guard to check if packageJson has the expected structure
      if (
        typeof packageJson !== 'object' ||
        packageJson === null ||
        !('repository' in packageJson) ||
        typeof packageJson.repository !== 'object' ||
        packageJson.repository === null ||
        !('url' in packageJson.repository) ||
        typeof packageJson.repository.url !== 'string'
      ) {
        return null;
      }

      const url = packageJson.repository.url;

      // Handle different URL formats
      let gitUrl = url;
      if (gitUrl.startsWith('git+')) {
        gitUrl = gitUrl.substring(4);
      }
      if (gitUrl.endsWith('.git')) {
        gitUrl = gitUrl.substring(0, gitUrl.length - 4);
      }

      // Extract owner and repo from GitHub URL
      const match = gitUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
      if (!match) {
        return null;
      }

      const [, owner, repo] = match;

      return {
        owner,
        repo,
        url: `https://github.com/${owner}/${repo}`
      };
    } catch {
      return null;
    }
  }
}
