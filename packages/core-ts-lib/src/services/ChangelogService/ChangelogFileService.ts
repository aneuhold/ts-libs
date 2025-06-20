import { access, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { CHANGELOG_FILENAME } from './types.js';

/**
 * Service for handling changelog file operations.
 */
export default class ChangelogFileService {
  /**
   * Gets the changelog file path for a given directory.
   *
   * @param packagePath Optional path to the package directory
   * @returns Full path to the changelog file
   */
  static getChangelogPath(packagePath?: string): string {
    const workingDir = packagePath || process.cwd();
    return path.join(workingDir, CHANGELOG_FILENAME);
  }

  /**
   * Checks if a changelog file exists.
   *
   * @param packagePath Optional path to the package directory
   * @returns True if changelog exists, false otherwise
   */
  static async changelogExists(packagePath?: string): Promise<boolean> {
    const changelogPath = this.getChangelogPath(packagePath);
    try {
      await access(changelogPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reads the changelog file content.
   *
   * @param packagePath Optional path to the package directory
   * @returns Changelog content as string
   * @throws Error if file doesn't exist or can't be read
   */
  static async readChangelog(packagePath?: string): Promise<string> {
    const changelogPath = this.getChangelogPath(packagePath);
    return await readFile(changelogPath, 'utf-8');
  }

  /**
   * Writes content to the changelog file.
   *
   * @param content The content to write
   * @param packagePath Optional path to the package directory
   */
  static async writeChangelog(content: string, packagePath?: string): Promise<void> {
    const changelogPath = this.getChangelogPath(packagePath);
    await writeFile(changelogPath, content);
  }

  /**
   * Creates a new changelog file with the given content.
   *
   * @param content The initial content
   * @param packagePath Optional path to the package directory
   */
  static async createChangelog(content: string, packagePath?: string): Promise<void> {
    await this.writeChangelog(content, packagePath);
  }
}
