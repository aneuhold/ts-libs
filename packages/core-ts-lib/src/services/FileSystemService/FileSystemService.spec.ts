import { writeFile } from 'fs/promises';
import path from 'path';
import FileSystemService from './FileSystemService.js';

const TEST_FOLDER_NAME = '__fileSystemService-tests__';

describe('FileSystemService', () => {
  afterAll(async () => {
    await deleteTestFolder();
  });

  describe('copyFolderContents', () => {
    it('should successfully copy all contents when target folder doesnt exist', async () => {
      // Make a test folder with a folder and a couple files in it
      const testName = 'copyFolderContents-1';
      const sourceFolderName = `${testName}-source`;
      const sourceFolderPath = await createTestFolder(sourceFolderName);
      await createTestFiles(sourceFolderPath, {
        'file1.txt': 'test text',
        'file2.txt': 'test text',
        subFolder: {
          'subFile1.txt': 'sub test text',
          'subFile2.txt': 'sub test text'
        }
      });

      const targetFolderPath = path.join(
        TEST_FOLDER_NAME,
        `${testName}-target`
      );

      // Execute
      await FileSystemService.copyFolderContents(
        sourceFolderPath,
        targetFolderPath
      );

      // Assert
      const expectedContents =
        await FileSystemService.getAllFilePathsRelative(sourceFolderPath);
      const actualContents =
        await FileSystemService.getAllFilePathsRelative(targetFolderPath);
      expect(actualContents).toEqual(expectedContents);
    });

    it('should successfully copy only files that arent ignored', async () => {
      // Make a test folder with a folder and a couple files in it
      const testName = 'copyFolderContents-2';
      const sourceFolderName = `${testName}-source`;
      const sourceFolderPath = await createTestFolder(sourceFolderName);
      await createTestFiles(sourceFolderPath, {
        'file1.txt': 'test text',
        'file2.txt': 'test text',
        subFolder: {
          'subFile1.txt': 'sub test text',
          'subFile2.txt': 'sub test text'
        },
        javascript: {
          'file1.js': 'test text',
          'file2.js': 'test text'
        },
        typescript: {
          'file1.ts': 'test text',
          'file2.ts': 'test text'
        }
      });

      const targetFolderPath = path.join(
        TEST_FOLDER_NAME,
        `${testName}-target`
      );

      // Execute
      await FileSystemService.copyFolderContents(
        sourceFolderPath,
        targetFolderPath,
        ['ts']
      );

      // Assert
      const expectedContents = (
        await FileSystemService.getAllFilePathsRelative(sourceFolderPath)
      )
        .filter((sourceFilePath) => !sourceFilePath.endsWith('.ts'))
        .sort();
      const actualContents = (
        await FileSystemService.getAllFilePathsRelative(targetFolderPath)
      ).sort();
      expect(actualContents).toEqual(expectedContents);
    });
  });
});

async function createTestFiles(folderPath: string, fileStructure: object) {
  await FileSystemService.checkOrCreateFolder(folderPath);

  await Promise.all(
    Object.entries(fileStructure).map(async ([key, value]) => {
      if (typeof value === 'string') {
        await writeFile(path.join(folderPath, key), value);
      } else if (typeof value === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        await createTestFiles(path.join(folderPath, key), value);
      }
    })
  );
}

async function createTestFolder(folderName: string): Promise<string> {
  const testFolderPath = path.join(TEST_FOLDER_NAME, folderName);
  await FileSystemService.checkOrCreateFolder(testFolderPath);
  return testFolderPath;
}

async function deleteTestFolder(): Promise<void> {
  await FileSystemService.deleteFolder(TEST_FOLDER_NAME);
}
