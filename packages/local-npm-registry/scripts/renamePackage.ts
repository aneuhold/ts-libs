#!/usr/bin/env tsx
/**
 * Script to rename all references from @aneuhold/local-npm-registry to local-npm-registry
 * in the local-npm-registry folder (one level up from this script)
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const OLD_PACKAGE_NAME = '@aneuhold/local-npm-registry';
const NEW_PACKAGE_NAME = 'local-npm-registry';
const __filename = fileURLToPath(import.meta.url);
const PACKAGE_DIR = join(dirname(__filename), '..');

/**
 * Rename package references from scoped to simple name
 */
function renamePackage(): void {
  console.log(`Renaming "${OLD_PACKAGE_NAME}" to "${NEW_PACKAGE_NAME}"`);

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

  console.log('✅ Package rename complete!');
}

renamePackage();
