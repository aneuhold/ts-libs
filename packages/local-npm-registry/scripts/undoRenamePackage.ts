import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PACKAGE_DIR = join(dirname(__filename), '..');

/**
 * Undo package rename by resetting git changes in the local-npm-registry folder
 */
function undoRenamePackage(): void {
  console.log('Undoing package rename by resetting git changes...');

  try {
    // Reset all changes in the package directory (excluding scripts folder)
    const gitCommand = `git checkout HEAD -- "${PACKAGE_DIR}"`;
    execSync(gitCommand, {
      cwd: PACKAGE_DIR,
      stdio: 'inherit'
    });

    console.log('✅ Package rename undo complete! All files reset to original state.');
  } catch (error) {
    console.error('❌ Error resetting git changes:', error);
    console.log('💡 Make sure you have git initialized and files are committed.');
  }
}

undoRenamePackage();
