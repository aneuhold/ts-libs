#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const MAX_ITERATIONS = 6;

/**
 * Returns a map of package.json path -> MD5 checksum for all packages.
 *
 * @param packagesDir The directory containing all packages.
 */
const snapshotChecksums = (packagesDir: string): Map<string, string> => {
  const checksums = new Map<string, string>();
  for (const dir of readdirSync(packagesDir)) {
    const pkgJsonPath = join(packagesDir, dir, 'package.json');
    if (statSync(join(packagesDir, dir)).isDirectory() && existsSync(pkgJsonPath)) {
      const content = readFileSync(pkgJsonPath, 'utf8');
      checksums.set(pkgJsonPath, createHash('md5').update(content).digest('hex'));
    }
  }
  return checksums;
};

const prepareAllPackages = (): void => {
  const packagesDir = join(process.cwd(), 'packages');

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    console.log(`\n--- Iteration ${i} ---`);

    const before = snapshotChecksums(packagesDir);

    execSync('pnpm -r --stream --parallel preparePkg', {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    execSync('pnpm -r --stream propagateVersion', {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    const after = snapshotChecksums(packagesDir);

    let changed = false;
    for (const [path, hash] of after) {
      if (before.get(path) !== hash) {
        changed = true;
        break;
      }
    }

    if (!changed) {
      console.log(`\nNo package.json changes detected. Stable after ${i} iteration(s).`);
      break;
    }

    if (i === MAX_ITERATIONS) {
      console.warn(
        `\nReached max iterations (${MAX_ITERATIONS}). Package versions may not be fully stable.`
      );
    }
  }

  console.log('\nRunning pnpm install...');
  execSync('pnpm i', { stdio: 'inherit', cwd: process.cwd() });
};

prepareAllPackages();
