import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const OLD_PACKAGE_NAME = 'local-npm-registry';
const NEW_PACKAGE_NAME = '@aneuhold/local-npm-registry';
const PACKAGE_DIR = join(dirname(__filename), '..');

/**
 * Undo package rename from simple back to scoped name
 */
function undoRenamePackage(): void {
  console.log(
    `Undoing rename: "${OLD_PACKAGE_NAME}" back to "${NEW_PACKAGE_NAME}"`
  );

  const files = readdirSync(PACKAGE_DIR);

  for (const file of files) {
    const filePath = join(PACKAGE_DIR, file);

    // Skip directories and scripts folder
    if (statSync(filePath).isDirectory()) {
      continue;
    }

    try {
      const content = readFileSync(filePath, 'utf8');

      if (content.includes(OLD_PACKAGE_NAME)) {
        console.log(`Updating ${file}...`);
        const updated = content.replaceAll(OLD_PACKAGE_NAME, NEW_PACKAGE_NAME);
        const urlEncodedUpdated = updated.replaceAll(
          encodeURIComponent(OLD_PACKAGE_NAME),
          encodeURIComponent(NEW_PACKAGE_NAME)
        );
        writeFileSync(filePath, urlEncodedUpdated, 'utf8');
        console.log(`✅ Updated ${file}`);
      }
    } catch {
      // Skip binary files or files we can't read
      continue;
    }
  }

  console.log('✅ Package rename undo complete!');
}

// Execute the undo
undoRenamePackage();
