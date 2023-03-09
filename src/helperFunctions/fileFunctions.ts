import { access, appendFile, mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import Log from '../utils/Log';

/**
 * Tries to add the provided snippet of text to the path provided. If the file
 * doesn't exist, it creates it. If the folders to the file don't exist, it
 * creates those. If the text already exists in the file, it does nothing.
 *
 * @param folderPath the path to the folder which contains the file that should
 * be updated
 */
export default async function findAndInsertText(
  folderPath: string,
  fileName: string,
  textToInsert: string
): Promise<void> {
  const filePath = path.join(folderPath, fileName);

  try {
    await access(folderPath);
  } catch (e) {
    console.log(e);
    Log.info(`Directory "${folderPath}" does not exist. Creating it now...`);
    await mkdir(folderPath, { recursive: true });
  }

  try {
    await access(filePath);
    const fileContents = await readFile(filePath);
    if (!fileContents.includes(textToInsert)) {
      await appendFile(filePath, `\n${textToInsert}`);
      Log.info(`Added "${textToInsert}" to "${filePath}"`);
    } else {
      Log.info(`"${textToInsert}" already exists in "${filePath}"`);
    }
  } catch {
    Log.info(
      `File at "${filePath}" didn't exist. Creating it now and adding "${textToInsert}" to it.`
    );
    await writeFile(filePath, textToInsert);
  }
}
