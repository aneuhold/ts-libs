#!/usr/bin/env node --no-warnings

import { DR } from '@aneuhold/core-ts-lib';
import { program } from 'commander';
import { LocalPackageStoreService } from './services/LocalPackageStoreService.js';

// TODO: Get the workspace root from a reliable source
const workspaceRoot = process.cwd(); // Assuming CWD is workspace root for now
const storeService = new LocalPackageStoreService(workspaceRoot);

program
  .name('local-npm')
  .description(
    'CLI to manage local npm package installations and updates for the ts-libs monorepo.'
  );

program
  .command('get-store')
  .description('Gets the current local package store.')
  .action(async () => {
    const store = await storeService.getStore();
    console.log(JSON.stringify(store, null, 2));
  });

program
  .command('update-package')
  .description('Updates a package in the local store.')
  .argument('<packageName>', 'The name of the package to update.')
  .argument('<version>', 'The new version of the package.')
  .action(async (packageName: string, version: string) => {
    await storeService.updatePackageVersion(packageName, version);
    DR.logger.info(
      `Package ${packageName} updated to version ${version} in the local store.`
    );
  });

program.parseAsync().catch((error: unknown) => {
  DR.logger.error(`Error executing command: ${String(error)}`);
  process.exit(1);
});
