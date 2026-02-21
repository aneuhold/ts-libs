import { exec } from 'child_process';
import { access, appendFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import ErrorUtils from '../../utils/ErrorUtils.js';
import { DR } from '../DependencyRegistry.js';
import StringService from '../StringService.js';
import GlobMatchingService from './GlobMatchingService.js';

const execAsync = promisify(exec);

/**
 * Options for the replaceInFiles method
 */
export type ReplaceInFilesOptions = {
  /** The string to search for */
  searchString: string;
  /** The string to replace it with */
  replaceString: string;
  /** The root directory to search in */
  rootPath: string;
  /** Array of glob-like patterns to include (defaults to all files) */
  includePatterns?: string[];
  /** Array of glob-like patterns to exclude (defaults to common ignore patterns) */
  excludePatterns?: string[];
  /** Whether to also replace URL-encoded versions of the strings */
  includeUrlEncoded?: boolean;
  /** If true, only shows what would be changed without making changes */
  dryRun?: boolean;
};

/**
 * A service which can be used to interact with the file system, only in build
 * steps.
 */
export default class FileSystemService {
  /**
   * Tries to add the provided snippet of text to the path provided. If the file
   * doesn't exist, it creates it. If the folders to the file don't exist, it
   * creates those. If the text already exists in the file, it does nothing.
   *
   * @param folderPath the path to the folder which contains the file that should
   * be updated
   * @param fileName the name of the file to update
   * @param textToInsert the text to insert into the file
   */
  static async findAndInsertText(
    folderPath: string,
    fileName: string,
    textToInsert: string
  ): Promise<void> {
    const filePath = path.join(folderPath, fileName);

    await FileSystemService.checkOrCreateFolder(folderPath);

    try {
      await access(filePath);
      const fileContents = await readFile(filePath);
      if (!fileContents.includes(textToInsert)) {
        await appendFile(filePath, `\n${textToInsert}`);
        DR.logger.info(`Added "${textToInsert}" to "${filePath}"`);
      } else {
        DR.logger.info(`"${textToInsert}" already exists in "${filePath}"`);
      }
    } catch {
      DR.logger.info(
        `File at "${filePath}" didn't exist. Creating it now and adding "${textToInsert}" to it.`
      );
      await writeFile(filePath, textToInsert);
    }
  }

  /**
   * Copies the contents of one folder to another folder.
   *
   * @param sourceFolderPath the path to the source folder
   * @param targetFolderPath the path to the target folder
   * @param ignoreExtensions is an array with extensions that should be
   * ignored. For example, if you want to ignore all .ts files, you would pass
   * in ['.ts']. Multi-part extensions like '.spec.ts' are also supported.
   */
  static async copyFolderContents(
    sourceFolderPath: string,
    targetFolderPath: string,
    ignoreExtensions?: string[]
  ): Promise<void> {
    // Check if the source directory exists first
    try {
      await access(sourceFolderPath);
    } catch {
      DR.logger.error(`Source directory "${sourceFolderPath}" does not exist.`);
      return;
    }
    await FileSystemService.checkOrCreateFolder(targetFolderPath);

    // Get the files in the source directory
    const sourceFilePaths = await FileSystemService.getAllFilePathsRelative(sourceFolderPath);

    await Promise.all(
      sourceFilePaths.map(async (sourceFilePath) => {
        const sourceFile = path.join(sourceFolderPath, sourceFilePath);
        const targetFile = path.join(targetFolderPath, sourceFilePath);

        // Check if the file should be ignored based on extensions
        if (ignoreExtensions && FileSystemService.shouldIgnoreFile(sourceFile, ignoreExtensions)) {
          return;
        }

        await cp(sourceFile, targetFile, { recursive: true });
      })
    );
  }

  static async checkOrCreateFolder(folderPath: string): Promise<void> {
    try {
      await access(folderPath);
    } catch {
      DR.logger.verbose.info(`Directory "${folderPath}" does not exist. Creating it now...`);
      await mkdir(folderPath, { recursive: true });
    }
  }

  static async deleteFolder(folderPath: string): Promise<void> {
    try {
      await access(folderPath);
    } catch {
      DR.logger.error(`Directory "${folderPath}" does not exist.`);
      return;
    }
    await rm(folderPath, { recursive: true });
  }

  /**
   * Gets all the file paths in the directory provided, including all
   * subdirectories, as an array of strings. The returned result will include
   * the directory path provided.
   *
   * If only relative file paths are needed, use {@link getAllFilePathsRelative}.
   *
   * @param dirPath the directory path to search for files in
   */
  static async getAllFilePaths(dirPath: string): Promise<string[]> {
    const entries = await readdir(dirPath, { recursive: true, withFileTypes: true });
    const filePaths: string[] = [];

    for (const entry of entries) {
      // Skip symlinks to avoid potential infinite loops
      if (entry.isSymbolicLink()) {
        continue;
      }

      // Only include files, not directories
      if (entry.isFile()) {
        const fullPath = path.join(entry.parentPath, entry.name);
        filePaths.push(fullPath);
      }
    }

    return filePaths;
  }

  /**
   * Gets all the file paths in the directory provided, including all
   * subdirectories, as an array of strings. The returned result will not
   * include the directory path provided.
   *
   * If absolute file paths are needed, use {@link getAllFilePaths}.
   *
   * @param dirPath the directory path to search for files in
   */
  static async getAllFilePathsRelative(dirPath: string): Promise<string[]> {
    const filePaths = await this.getAllFilePaths(dirPath);
    return filePaths.map((filePath) => {
      const relativePath = filePath.replace(dirPath, '');
      // Remove leading path separator if present
      return relativePath.startsWith('/') || relativePath.startsWith('\\')
        ? relativePath.slice(1)
        : relativePath;
    });
  }

  /**
   * Checks if there are any pending uncommitted changes in the git repository
   * in the current working directory.
   *
   * @returns true if there are pending changes, false otherwise.
   */
  static async hasPendingChanges(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain');
      return stdout.trim().length > 0;
    } catch (error) {
      DR.logger.error(`Failed to check for pending changes: ${ErrorUtils.getErrorString(error)}`);
      return false;
    }
  }

  /**
   * Searches for a file by traversing up the directory tree starting from the
   * specified directory. This is useful for finding configuration files,
   * project root markers, or other files that should be found by walking up
   * the directory hierarchy.
   *
   * @param startDir - The directory to start searching from
   * @param fileName - The name of the file to search for
   * @param stopAt - Optional directory path to stop searching at (defaults to root)
   */
  static async findFileUpTree(
    startDir: string,
    fileName: string,
    stopAt?: string
  ): Promise<string | null> {
    const results = await this.traverseDirectoryTree(
      startDir,
      fileName,
      stopAt,
      true // findFirst = true
    );
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Searches for all files with the given name by traversing up the directory tree
   * starting from the specified directory. Returns all found files from closest
   * to furthest (root).
   *
   * @param startDir - The directory to start searching from
   * @param fileName - The name of the file to search for
   * @param stopAt - Optional directory path to stop searching at (defaults to root)
   */
  static async findAllFilesUpTree(
    startDir: string,
    fileName: string,
    stopAt?: string
  ): Promise<string[]> {
    return this.traverseDirectoryTree(
      startDir,
      fileName,
      stopAt,
      false // findFirst = false
    );
  }

  /**
   * Checks if there are any changes in a directory compared to the main branch.
   *
   * @param absolutePath Optional absolute path to check for changes. If not provided, uses current working directory.
   * @returns true if there are changes compared to main, false otherwise
   * @throws {Error} if not in a git repository
   */
  static async hasChangesComparedToMain(absolutePath?: string): Promise<boolean> {
    const targetDir = absolutePath ?? process.cwd();

    try {
      // Get git repository root
      const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel', {
        cwd: targetDir
      });
      const repoRoot = gitRoot.trim();

      // Determine git diff command - prefer origin/main, fallback to HEAD~1
      const gitCommand = await this.getGitDiffCommand(repoRoot);

      // Get changed files
      const { stdout } = await execAsync(gitCommand, { cwd: repoRoot });
      const changedFiles = stdout.trim().split('\n').filter(Boolean);

      // Get relative path from git root to target directory
      const relativePath = path.relative(repoRoot, targetDir).replace(/\\/g, '/');

      // If at git root, check for any changes
      if (!relativePath || relativePath === '.') {
        return changedFiles.length > 0;
      }

      // Check if any changed files are within the target directory
      return changedFiles.some(
        (file) => file.startsWith(`${relativePath}/`) || file === relativePath
      );
    } catch (error) {
      const errorMessage = ErrorUtils.getErrorString(error);

      if (errorMessage.includes('not a git repository')) {
        throw new Error(`Not in a git repository: ${targetDir}`, { cause: error });
      }

      DR.logger.error(`Failed to check for changes compared to main: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Replaces all occurrences of a string in files within a directory.
   * Supports glob patterns for including/excluding files and handles URL encoding.
   *
   * @param options Configuration object for the replacement operation
   */
  static async replaceInFiles(options: ReplaceInFilesOptions): Promise<void> {
    const {
      searchString,
      replaceString,
      rootPath,
      includePatterns = ['**/*'],
      excludePatterns = ['**/node_modules/**', '**/.*/**'],
      includeUrlEncoded = true,
      dryRun = false
    } = options;

    DR.logger.info(`Replacing "${searchString}" with "${replaceString}" in ${rootPath}`);

    if (dryRun) {
      DR.logger.info('DRY RUN MODE - No files will be modified');
    }

    const allFiles = await this.getAllFilePaths(rootPath);
    const filesToProcess = GlobMatchingService.getMatchingFiles(
      allFiles,
      rootPath,
      includePatterns,
      excludePatterns
    );

    let processedCount = 0;
    let modifiedCount = 0;

    for (const filePath of filesToProcess) {
      try {
        const content = await readFile(filePath, 'utf8');
        let hasChanges = false;
        let updatedContent = content;

        // Replace the main string
        if (content.includes(searchString)) {
          updatedContent = updatedContent.replaceAll(searchString, replaceString);
          hasChanges = true;
        }

        // Replace URL-encoded version if requested
        if (includeUrlEncoded) {
          const encodedSearchString = encodeURIComponent(searchString);
          const encodedReplaceString = encodeURIComponent(replaceString);

          if (updatedContent.includes(encodedSearchString)) {
            updatedContent = updatedContent.replaceAll(encodedSearchString, encodedReplaceString);
            hasChanges = true;
          }
        }

        if (hasChanges) {
          const relativePath = path.relative(rootPath, filePath);
          DR.logger.info(`${dryRun ? 'Would update' : 'Updating'} ${relativePath}...`);

          if (!dryRun) {
            await writeFile(filePath, updatedContent, 'utf8');
          }

          modifiedCount++;
        }

        processedCount++;
      } catch (error) {
        // Skip binary files or files we can't read
        DR.logger.verbose.info(`Skipping ${filePath}: ${ErrorUtils.getErrorString(error)}`);
        continue;
      }
    }

    DR.logger.info(
      `${dryRun ? 'Would process' : 'Processed'} ${processedCount} files, ${dryRun ? 'would modify' : 'modified'} ${modifiedCount} files`
    );
  }

  /**
   * Determines the appropriate git diff command to use.
   *
   * @param repoRoot The git repository root directory
   * @returns The git diff command to use
   */
  private static async getGitDiffCommand(repoRoot: string): Promise<string> {
    try {
      await execAsync('git show-ref --verify --quiet refs/remotes/origin/main', {
        cwd: repoRoot
      });
      // Returns all changed files compared to origin/main, including uncommitted changes
      return 'git diff --name-only $(git merge-base origin/main HEAD)';
    } catch {
      DR.logger.verbose.info('origin/main not found, comparing to HEAD~1');
      return 'git diff --name-only HEAD~1';
    }
  }

  /**
   * Internal helper method that traverses up the directory tree looking for files.
   *
   * @param startDir - The directory to start searching from
   * @param fileName - The name of the file to search for
   * @param stopAt - Optional directory path to stop searching at (defaults to root)
   * @param findFirst - If true, stops after finding the first file
   */
  private static async traverseDirectoryTree(
    startDir: string,
    fileName: string,
    stopAt?: string,
    findFirst = false
  ): Promise<string[]> {
    const results: string[] = [];
    let currentDir = path.resolve(startDir);
    const rootDir = stopAt ? path.resolve(stopAt) : path.parse(currentDir).root;

    while (currentDir !== rootDir) {
      const filePath = path.join(currentDir, fileName);

      try {
        await access(filePath);
        results.push(filePath);
        if (findFirst) {
          return results;
        }
      } catch {
        // File doesn't exist, continue searching
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        // Reached the root directory
        break;
      }
      currentDir = parentDir;
    }

    // Check the root/stop directory as well
    const filePath = path.join(currentDir, fileName);
    try {
      await access(filePath);
      results.push(filePath);
    } catch {
      // File not found
    }

    return results;
  }

  /**
   * Checks if a file should be ignored based on the provided extensions.
   * Supports both simple extensions (e.g., '.ts') and multi-part extensions (e.g., '.spec.ts').
   *
   * @param filePath the path to the file to check
   * @param ignoreExtensions array of extensions to ignore
   */
  private static shouldIgnoreFile(filePath: string, ignoreExtensions: string[]): boolean {
    const fileName = path.basename(filePath);

    return ignoreExtensions.some((extension) => {
      // Handle multi-part extensions like '.spec.ts'
      if (extension.includes('.', 1)) {
        return fileName.endsWith(extension);
      }

      // Handle simple extensions like '.ts'
      const fileExtension = StringService.getFileNameExtension(filePath);
      return fileExtension === extension;
    });
  }
}
