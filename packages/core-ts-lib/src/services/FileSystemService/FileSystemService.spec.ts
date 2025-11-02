import { readFile, symlink, writeFile } from 'fs/promises';
import path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
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

      const targetFolderPath = path.join(TEST_FOLDER_NAME, `${testName}-target`);

      // Execute
      await FileSystemService.copyFolderContents(sourceFolderPath, targetFolderPath);

      // Assert
      const expectedContents = (
        await FileSystemService.getAllFilePathsRelative(sourceFolderPath)
      ).sort();
      const actualContents = (
        await FileSystemService.getAllFilePathsRelative(targetFolderPath)
      ).sort();
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

      const targetFolderPath = path.join(TEST_FOLDER_NAME, `${testName}-target`);

      // Execute
      await FileSystemService.copyFolderContents(sourceFolderPath, targetFolderPath, ['ts']);

      // Assert
      const expectedContents = (await FileSystemService.getAllFilePathsRelative(sourceFolderPath))
        .filter((sourceFilePath) => !sourceFilePath.endsWith('.ts'))
        .sort();
      const actualContents = (
        await FileSystemService.getAllFilePathsRelative(targetFolderPath)
      ).sort();
      expect(actualContents).toEqual(expectedContents);
    });
  });

  describe('replaceInFiles', () => {
    it('should replace text in multiple files', async () => {
      const testName = 'replaceInFiles-1';
      const testFolderPath = await createTestFolder(testName);

      // Create test files with content to replace
      await createTestFiles(testFolderPath, {
        'file1.txt': 'Hello OLD_TEXT world',
        'file2.js': 'const value = "OLD_TEXT";',
        'file3.md': '# Title\nThis contains OLD_TEXT in markdown.',
        subfolder: {
          'nested.txt': 'Nested OLD_TEXT content'
        }
      });

      // Execute the replacement
      await FileSystemService.replaceInFiles({
        searchString: 'OLD_TEXT',
        replaceString: 'NEW_TEXT',
        rootPath: testFolderPath,
        includePatterns: ['**/*'],
        excludePatterns: ['**/*.js'], // Exclude JavaScript files
        includeUrlEncoded: false,
        dryRun: false
      });

      // Verify replacements
      const file1Content = await readFile(path.join(testFolderPath, 'file1.txt'), 'utf8');
      const file2Content = await readFile(path.join(testFolderPath, 'file2.js'), 'utf8');
      const file3Content = await readFile(path.join(testFolderPath, 'file3.md'), 'utf8');
      const nestedContent = await readFile(
        path.join(testFolderPath, 'subfolder', 'nested.txt'),
        'utf8'
      );

      expect(file1Content).toBe('Hello NEW_TEXT world');
      expect(file2Content).toBe('const value = "OLD_TEXT";'); // Should not change due to exclusion
      expect(file3Content).toBe('# Title\nThis contains NEW_TEXT in markdown.');
      expect(nestedContent).toBe('Nested NEW_TEXT content');
    });

    it('should handle URL-encoded text replacement', async () => {
      const testName = 'replaceInFiles-2';
      const testFolderPath = await createTestFolder(testName);

      await createTestFiles(testFolderPath, {
        'config.json': JSON.stringify(
          {
            name: '@old/package-name',
            encoded: encodeURIComponent('@old/package-name')
          },
          null,
          2
        )
      });

      await FileSystemService.replaceInFiles({
        searchString: '@old/package-name',
        replaceString: '@new/package-name',
        rootPath: testFolderPath,
        includeUrlEncoded: true,
        dryRun: false
      });

      const configContent = await readFile(path.join(testFolderPath, 'config.json'), 'utf8');
      const config = JSON.parse(configContent) as {
        name: string;
        encoded: string;
      };

      expect(config.name).toBe('@new/package-name');
      expect(config.encoded).toBe(encodeURIComponent('@new/package-name'));
    });

    it('should respect dry run mode', async () => {
      const testName = 'replaceInFiles-3';
      const testFolderPath = await createTestFolder(testName);

      await createTestFiles(testFolderPath, {
        'test.txt': 'Original OLD_TEXT content'
      });

      await FileSystemService.replaceInFiles({
        searchString: 'OLD_TEXT',
        replaceString: 'NEW_TEXT',
        rootPath: testFolderPath,
        dryRun: true
      });

      const content = await readFile(path.join(testFolderPath, 'test.txt'), 'utf8');

      expect(content).toBe('Original OLD_TEXT content'); // Should not change in dry run
    });
  });

  describe('getAllFilePaths', () => {
    it('should handle circular symlinks without infinite loop', async () => {
      const testName = 'getAllFilePaths-circular-symlink';
      const testFolderPath = await createTestFolder(testName);

      // Create a directory structure with some files
      await createTestFiles(testFolderPath, {
        'file1.txt': 'content1',
        'file2.txt': 'content2',
        subfolder: {
          'nested.txt': 'nested content'
        }
      });

      // Create a circular symlink: subfolder/link-to-parent -> testFolderPath
      const symlinkPath = path.join(testFolderPath, 'subfolder', 'link-to-parent');
      try {
        await symlink(testFolderPath, symlinkPath, 'dir');
      } catch {
        // Skip test on systems that don't support symlinks (e.g., Windows without admin)
        console.warn('Skipping circular symlink test - symlinks not supported');
        return;
      }

      // This should complete without hanging in an infinite loop
      const startTime = Date.now();
      const files = await FileSystemService.getAllFilePaths(testFolderPath);
      const duration = Date.now() - startTime;

      // Verify it completed quickly (should be under 5 seconds even on slow systems)
      expect(duration).toBeLessThan(5000);

      // Verify we got the expected files (symlinks should be skipped)
      const relativeFiles = files.map((f) => path.relative(testFolderPath, f)).sort();

      expect(relativeFiles).toEqual([
        'file1.txt',
        'file2.txt',
        path.join('subfolder', 'nested.txt')
      ]);
    });

    it('should handle getAllFilePathsRelative with circular symlinks', async () => {
      const testName = 'getAllFilePathsRelative-circular-symlink';
      const testFolderPath = await createTestFolder(testName);

      // Create files and a circular symlink
      await createTestFiles(testFolderPath, {
        'root.txt': 'root content',
        deep: {
          level1: {
            level2: {
              'deep.txt': 'deep content'
            }
          }
        }
      });

      // Create circular symlink at deep level pointing back to root
      const deepPath = path.join(testFolderPath, 'deep', 'level1', 'level2');
      const symlinkPath = path.join(deepPath, 'link-to-root');
      try {
        await symlink(testFolderPath, symlinkPath, 'dir');
      } catch {
        // Skip test on systems that don't support symlinks
        console.warn('Skipping circular symlink test - symlinks not supported');
        return;
      }

      // Should complete without infinite loop
      const files = await FileSystemService.getAllFilePathsRelative(testFolderPath);
      const sortedFiles = files.sort();

      // Should get files but not traverse through the symlink
      expect(sortedFiles).toEqual([path.join('deep', 'level1', 'level2', 'deep.txt'), 'root.txt']);
    });
  });
});

/**
 * Creates test files and folders based on the provided structure
 *
 * @param folderPath The path where the files and folders should be created
 * @param fileStructure An object representing the file structure to create
 */
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

/**
 * Creates a test folder within the main test directory
 *
 * @param folderName The name of the folder to create
 */
async function createTestFolder(folderName: string): Promise<string> {
  const testFolderPath = path.join(TEST_FOLDER_NAME, folderName);
  await FileSystemService.checkOrCreateFolder(testFolderPath);
  return testFolderPath;
}

/**
 * Deletes the main test folder and all its contents
 */
async function deleteTestFolder(): Promise<void> {
  await FileSystemService.deleteFolder(TEST_FOLDER_NAME);
}
