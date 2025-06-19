import PackageService from '../src/services/PackageService/PackageService.js';
import { VersionType } from '../src/types/VersionType.js';

/**
 * Bumps the version if needed and initializes changelog. This is a separate
 * script here, but it will be integrated into main-scripts.
 *
 * Usage:
 * - `npx tsx scripts/bumpVersionAndInitializeChangelog.ts` (defaults to patch)
 * - `npx tsx scripts/bumpVersionAndInitializeChangelog.ts patch`
 * - `npx tsx scripts/bumpVersionAndInitializeChangelog.ts minor`
 * - `npx tsx scripts/bumpVersionAndInitializeChangelog.ts major`
 *
 * The script will:
 * 1. Check if the current version needs to be bumped by comparing with npm registry
 * 2. Only bump the version if current version is <= latest published version
 * 3. Initialize or update changelog for the final version
 * 4. Be idempotent - can be run multiple times safely
 */
async function bumpVersionAndInitializeChangelog() {
  // Parse command line arguments for version type
  const args = process.argv.slice(2);
  let versionType: VersionType = VersionType.Patch;

  if (args.length > 0) {
    const versionArg = args[0].toLowerCase();
    switch (versionArg) {
      case 'major':
        versionType = VersionType.Major;
        break;
      case 'minor':
        versionType = VersionType.Minor;
        break;
      case 'patch':
        versionType = VersionType.Patch;
        break;
      default:
        console.warn(`Invalid version type '${versionArg}'. Using 'patch' as default.`);
        break;
    }
  }

  await PackageService.bumpVersionIfNeededAndInitializeChangelog(versionType);
}

void bumpVersionAndInitializeChangelog();
