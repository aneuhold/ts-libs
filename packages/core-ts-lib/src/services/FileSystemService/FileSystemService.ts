import { exec } from 'child_process';
import {
  access,
  appendFile,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import ErrorUtils from '../../utils/ErrorUtils.js';
import { DR } from '../DependencyRegistry.js';
import StringService from '../StringService.js';

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
   * @param fileName
   * @param textToInsert
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
   * @param sourceFolderPath
   * @param targetFolderPath
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
    const sourceFilePaths =
      await FileSystemService.getAllFilePathsRelative(sourceFolderPath);

    await Promise.all(
      sourceFilePaths.map(async (sourceFilePath) => {
        const sourceFile = path.join(sourceFolderPath, sourceFilePath);
        const targetFile = path.join(targetFolderPath, sourceFilePath);

        // Check if the file should be ignored based on extensions
        if (
          ignoreExtensions &&
          FileSystemService.shouldIgnoreFile(sourceFile, ignoreExtensions)
        ) {
          return;
        }

        await cp(sourceFile, targetFile, { recursive: true });
      })
    );
  }

  /**
   * Checks if a file should be ignored based on the provided extensions.
   * Supports both simple extensions (e.g., '.ts') and multi-part extensions (e.g., '.spec.ts').
   *
   * @param filePath the path to the file to check
   * @param ignoreExtensions array of extensions to ignore
   */
  private static shouldIgnoreFile(
    filePath: string,
    ignoreExtensions: string[]
  ): boolean {
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

  static async checkOrCreateFolder(folderPath: string): Promise<void> {
    try {
      await access(folderPath);
    } catch {
      DR.logger.verbose.info(
        `Directory "${folderPath}" does not exist. Creating it now...`
      );
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
    const filePaths: string[] = [];
    const fileOrFolderNames = await readdir(dirPath);

    await Promise.all(
      fileOrFolderNames.map(async (fileOrFolder) => {
        const absolutePath = path.join(dirPath, fileOrFolder);
        const fileStat = await stat(absolutePath);

        if (fileStat.isDirectory()) {
          filePaths.push(...(await this.getAllFilePaths(absolutePath)));
        } else {
          filePaths.push(absolutePath);
        }
      })
    );

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
      DR.logger.error(
        `Failed to check for pending changes: ${ErrorUtils.getErrorString(error)}`
      );
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

    DR.logger.info(
      `Replacing "${searchString}" with "${replaceString}" in ${rootPath}`
    );

    if (dryRun) {
      DR.logger.info('DRY RUN MODE - No files will be modified');
    }

    const filesToProcess = await this.getMatchingFiles(
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
          updatedContent = updatedContent.replaceAll(
            searchString,
            replaceString
          );
          hasChanges = true;
        }

        // Replace URL-encoded version if requested
        if (includeUrlEncoded) {
          const encodedSearchString = encodeURIComponent(searchString);
          const encodedReplaceString = encodeURIComponent(replaceString);

          if (updatedContent.includes(encodedSearchString)) {
            updatedContent = updatedContent.replaceAll(
              encodedSearchString,
              encodedReplaceString
            );
            hasChanges = true;
          }
        }

        if (hasChanges) {
          const relativePath = path.relative(rootPath, filePath);
          DR.logger.info(
            `${dryRun ? 'Would update' : 'Updating'} ${relativePath}...`
          );

          if (!dryRun) {
            await writeFile(filePath, updatedContent, 'utf8');
          }

          modifiedCount++;
        }

        processedCount++;
      } catch (error) {
        // Skip binary files or files we can't read
        DR.logger.verbose.info(
          `Skipping ${filePath}: ${ErrorUtils.getErrorString(error)}`
        );
        continue;
      }
    }

    DR.logger.info(
      `${dryRun ? 'Would process' : 'Processed'} ${processedCount} files, ${dryRun ? 'would modify' : 'modified'} ${modifiedCount} files`
    );
  }

  /**
   * Gets files matching the include patterns while excluding those that match exclude patterns.
   * Uses simple glob-like matching for common patterns.
   *
   * @param rootPath The root directory to search in
   * @param includePatterns Array of glob-like patterns to include
   * @param excludePatterns Array of glob-like patterns to exclude
   */
  private static async getMatchingFiles(
    rootPath: string,
    includePatterns: string[],
    excludePatterns: string[]
  ): Promise<string[]> {
    const allFiles = await this.getAllFilePaths(rootPath);

    return allFiles.filter((filePath) => {
      const relativePath = path.relative(rootPath, filePath);

      // Check if file matches any exclude pattern
      if (
        excludePatterns.some((pattern) =>
          this.matchesPattern(relativePath, pattern)
        )
      ) {
        return false;
      }

      // Check if file matches any include pattern
      return includePatterns.some((pattern) =>
        this.matchesPattern(relativePath, pattern)
      );
    });
  }

  /**
   * Simple glob-like pattern matching for common use cases.
   * Supports:
   * - ** for any number of directories
   * - * for any characters except path separators
   * - Exact matches
   *
   * @param filePath The file path to test
   * @param pattern The pattern to match against
   */
  private static matchesPattern(filePath: string, pattern: string): boolean {
    // Handle special case of **/* which should match everything
    if (pattern === '**/*') {
      return true;
    }

    // Handle patterns like **/*.ext - they should match files in root and subdirectories
    if (pattern.startsWith('**/')) {
      const remainingPattern = pattern.slice(3); // Remove **/
      // Test both the root file pattern and the full pattern
      return (
        this.matchesPattern(filePath, remainingPattern) ||
        this.matchesSimpleGlob(filePath, pattern)
      );
    }

    return this.matchesSimpleGlob(filePath, pattern);
  }

  /**
   * Matches a simple glob pattern against a file path
   *
   * @param filePath The file path to test
   * @param pattern The pattern to match against
   */
  private static matchesSimpleGlob(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*') // ** matches any number of directories
      .replace(/\*/g, '[^/\\\\]*') // * matches any characters except path separators
      .replace(/\./g, '\\.'); // Escape dots

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath.replace(/\\/g, '/')); // Normalize path separators
  }
}
