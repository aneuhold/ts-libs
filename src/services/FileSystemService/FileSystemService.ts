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
import Logger from '../../utils/Logger';
import StringService from '../StringService';

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
        Logger.info(`Added "${textToInsert}" to "${filePath}"`);
      } else {
        Logger.info(`"${textToInsert}" already exists in "${filePath}"`);
      }
    } catch {
      Logger.info(
        `File at "${filePath}" didn't exist. Creating it now and adding "${textToInsert}" to it.`
      );
      await writeFile(filePath, textToInsert);
    }
  }

  /**
   * Copies the contents of one folder to another folder.
   *
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
      Logger.error(`Source directory "${sourceFolderPath}" does not exist.`);
      return;
    }
    await FileSystemService.checkOrCreateFolder(targetFolderPath);

    // Get the files in the source directory
    const sourceFilePaths = await FileSystemService.getAllFilePathsRelative(
      sourceFolderPath
    );

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
      Logger.verbose.info(
        `Directory "${folderPath}" does not exist. Creating it now...`
      );
      await mkdir(folderPath, { recursive: true });
    }
  }

  static async deleteFolder(folderPath: string): Promise<void> {
    try {
      await access(folderPath);
    } catch {
      Logger.error(`Directory "${folderPath}" does not exist.`);
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
   */
  static async getAllFilePathsRelative(dirPath: string): Promise<string[]> {
    const filePaths = await this.getAllFilePaths(dirPath);
    return filePaths.map((filePath) => {
      return filePath.replace(dirPath, '');
    });
  }
}
