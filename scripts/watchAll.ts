#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import type { PackageJson } from '../packages/core-ts-lib/src/types/PackageJson.js';

/**
 * Script to watch all packages using concurrently with labeled output
 */
const watchAllPackages = (): void => {
  const packagesDir = join(process.cwd(), 'packages');

  try {
    // Get all package directories that have a watch script
    const packageDirs = readdirSync(packagesDir).filter((dir) => {
      const packagePath = join(packagesDir, dir);
      const packageJsonPath = join(packagePath, 'package.json');

      if (!statSync(packagePath).isDirectory() || !existsSync(packageJsonPath)) {
        return false;
      }

      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
        return packageJson.scripts?.['watch'];
      } catch {
        return false;
      }
    });

    if (packageDirs.length === 0) {
      console.log('No packages with watch scripts found');
      return;
    }

    // Build concurrently command with proper labeling
    const commands = packageDirs.map((dir) => `"pnpm --filter ${dir} watch"`).join(' ');

    const names = packageDirs.join(',');

    // Run concurrently with labeled output
    // For some reason, if `pnpm` is used, it will fail whenever the `watch` script is stopped.
    // This doesn't hurt anything, it just looks bad.
    const command = `pnpm concurrently --kill-others-on-fail --prefix-colors "auto" --names ${names} ${commands}`;

    console.log('🔄 Starting watch mode for all packages...');
    console.log(`Watching: ${packageDirs.join(', ')}`);
    console.log('');

    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  } catch (error) {
    console.error('❌ Watch failed:', error);
    process.exit(1);
  }
};

watchAllPackages();
