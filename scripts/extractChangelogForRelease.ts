#!/usr/bin/env tsx

import { join } from 'path';
import ChangelogService from '../packages/core-ts-lib/src/services/ChangelogService/ChangelogService.js';

/**
 * TypeScript script to extract changelog content for a specific package and version.
 * This uses the ChangelogService from core-ts-lib and is used by GitHub Actions.
 *
 * Usage: tsx extractChangelogForRelease.ts <package-name> <version> [--quiet]
 * Example: tsx extractChangelogForRelease.ts core-ts-api-lib 2.1.22
 * Example: tsx extractChangelogForRelease.ts core-ts-api-lib 2.1.22 --quiet
 */
async function extractChangelogForVersion(): Promise<void> {
  const packageName = process.argv[2];
  const version = process.argv[3];
  const isQuiet = process.argv.includes('--quiet');

  if (!packageName || !version) {
    console.error('Usage: tsx extractChangelogForRelease.ts <package-name> <version> [--quiet]');
    console.error('Example: tsx extractChangelogForRelease.ts core-ts-api-lib 2.1.22');
    process.exit(1);
  }

  const packagePath = join('packages', packageName);

  // Determine the correct package path based on current working directory
  let resolvedPackagePath: string;
  if (process.cwd().endsWith(`packages/${packageName}`)) {
    // We're already in the package directory (GitHub Actions scenario)
    resolvedPackagePath = '.';
  } else {
    // We're in the root directory
    resolvedPackagePath = packagePath;
  }

  try {
    if (!isQuiet) {
      console.log(`Extracting changelog for ${packageName} version ${version}...`);
      console.log('');
    }

    // Suppress console output from the ChangelogService when in quiet mode
    let originalConsoleLog: typeof console.log | undefined;
    let originalConsoleInfo: typeof console.info | undefined;
    let originalConsoleError: typeof console.error | undefined;

    if (isQuiet) {
      originalConsoleLog = console.log;
      originalConsoleInfo = console.info;
      originalConsoleError = console.error;

      // Temporarily suppress console output
      console.log = () => {};
      console.info = () => {};
      console.error = () => {};
    }

    try {
      // Use the ChangelogService to extract changelog content
      const releaseNotesContent = await ChangelogService.getChangelogContentForVersion(
        version,
        resolvedPackagePath
      );

      // Restore console functions
      if (isQuiet && originalConsoleLog && originalConsoleInfo && originalConsoleError) {
        console.log = originalConsoleLog;
        console.info = originalConsoleInfo;
        console.error = originalConsoleError;
      }

      if (!isQuiet) {
        console.log('✅ Successfully extracted changelog content');
        console.log('');
        console.log('📝 Release Notes Content:');
        console.log('========================');
      }

      // Output only the content (this is what GitHub Actions will capture)
      console.log(releaseNotesContent);
    } finally {
      // Ensure console functions are restored even if an error occurs
      if (isQuiet && originalConsoleLog && originalConsoleInfo && originalConsoleError) {
        console.log = originalConsoleLog;
        console.info = originalConsoleInfo;
        console.error = originalConsoleError;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (!isQuiet) {
      console.error(`❌ Error extracting changelog for ${packageName}:`, errorMessage);
    }

    // Output fallback message and exit with error code
    console.log(`Release notes for ${version} - See CHANGELOG.md for details.`);
    process.exit(1);
  }
}

await extractChangelogForVersion();
