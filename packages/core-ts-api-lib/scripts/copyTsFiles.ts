import { FileSystemService } from '@aneuhold/core-ts-lib';

/**
 * Copies the original TypeScript files to the lib folder. This can make it
 * easier to debug the code that is published.
 */
async function copyTsFilesToLib() {
  // This paths from the executing directory, which is at root.
  await FileSystemService.copyFolderContents('src', 'lib', ['.spec.ts']);
}

void copyTsFilesToLib();
