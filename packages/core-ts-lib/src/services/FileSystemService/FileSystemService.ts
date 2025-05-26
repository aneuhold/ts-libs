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
   * in ['ts'].
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

    // console.log(sourceFilePaths);

    await Promise.all(
      sourceFilePaths.map(async (sourceFilePath) => {
        const sourceFile = path.join(sourceFolderPath, sourceFilePath);
        const targetFile = path.join(targetFolderPath, sourceFilePath);

        const sourceFileExtension =
          StringService.getFileNameExtension(sourceFile);
        if (
          sourceFileExtension &&
          ignoreExtensions?.includes(sourceFileExtension)
        ) {
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
   * @param dirPath
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
   * @param dirPath
   */
  static async getAllFilePathsRelative(dirPath: string): Promise<string[]> {
    const filePaths = await this.getAllFilePaths(dirPath);
    return filePaths.map((filePath) => {
      return filePath.replace(dirPath, '');
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
    let currentDir = path.resolve(startDir);
    const rootDir = stopAt ? path.resolve(stopAt) : path.parse(currentDir).root;

    while (currentDir !== rootDir) {
      const filePath = path.join(currentDir, fileName);

      try {
        await access(filePath);
        return filePath;
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
      return filePath;
    } catch {
      // File not found
      return null;
    }
  }
}
