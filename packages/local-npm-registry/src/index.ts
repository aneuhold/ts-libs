#!/usr/bin/env node --no-warnings

import { DR } from '@aneuhold/core-ts-lib';
import { program } from 'commander';
import { ConfigService } from './services/ConfigService.js';
import { LocalPackageStoreService } from './services/LocalPackageStoreService.js';

program
  .name('local-npm')
  .description(
    'CLI to manage local npm package installations and updates for the ts-libs monorepo.'
  );

program
  .command('get-store')
  .description('Gets the current local package store.')
  .action(async () => {
    const store = await LocalPackageStoreService.getStore();
    console.log(JSON.stringify(store, null, 2));
  });

program
  .command('update-package')
  .description('Updates a package in the local store.')
  .argument('<packageName>', 'The name of the package to update.')
  .argument('<version>', 'The new version of the package.')
  .action(async (packageName: string, version: string) => {
    await LocalPackageStoreService.updatePackageVersion(packageName, version);
    DR.logger.info(
      `Package ${packageName} updated to version ${version} in the local store.`
    );
  });

program
  .command('config')
  .description('Shows the current configuration and config file location.')
  .action(async () => {
    const config = await ConfigService.loadConfig();
    const configPath = ConfigService.getConfigFilePath();

    console.log('Current Configuration:');
    console.log(JSON.stringify(config, null, 2));
    console.log('\nConfiguration file location:');
    console.log(configPath || 'No configuration file found (using defaults)');
  });

program
  .command('init-config')
  .description('Creates a default configuration file in the current directory.')
  .action(async () => {
    try {
      const configPath = await ConfigService.createDefaultConfig(process.cwd());
      DR.logger.info(`Configuration file created at: ${configPath}`);
    } catch (error) {
      DR.logger.error(`Failed to create configuration file: ${String(error)}`);
      process.exit(1);
    }
  });

program.parseAsync().catch((error: unknown) => {
  DR.logger.error(`Error executing command: ${String(error)}`);
  process.exit(1);
});
