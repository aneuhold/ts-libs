#!/usr/bin/env node --no-warnings

import { DR } from '@aneuhold/core-ts-lib';
import { program } from 'commander';
import { CommandService } from './services/CommandService.js';
import { ConfigService } from './services/ConfigService.js';
import { LocalPackageStoreService } from './services/LocalPackageStoreService.js';

program
  .name('local-npm')
  .description(
    'CLI to manage local npm package installations as if they were published.'
  );

// Main commands as described in README.md
program
  .command('publish')
  .description(
    'Publish a package and update all subscribers with timestamp version'
  )
  .action(async () => {
    try {
      await CommandService.publish();
    } catch (error) {
      DR.logger.error(`Failed to publish: ${String(error)}`);
      process.exit(1);
    }
  });

program
  .command('subscribe')
  .description(
    'Subscribe to a package and install its latest timestamp version'
  )
  .argument('<package-name>', 'The name of the package to subscribe to')
  .action(async (packageName: string) => {
    try {
      await CommandService.subscribe(packageName);
    } catch (error) {
      DR.logger.error(`Failed to subscribe: ${String(error)}`);
      process.exit(1);
    }
  });

program
  .command('unpublish')
  .description(
    'Unpublish a package and reset all subscribers to original versions'
  )
  .argument(
    '[package-name]',
    'The name of the package to unpublish (defaults to current directory package)'
  )
  .action(async (packageName?: string) => {
    try {
      await CommandService.unpublish(packageName);
    } catch (error) {
      DR.logger.error(`Failed to unpublish: ${String(error)}`);
      process.exit(1);
    }
  });

program
  .command('unsubscribe')
  .description('Unsubscribe from packages and reset to original versions')
  .argument(
    '[package-name]',
    'The name of the package to unsubscribe from (omit to unsubscribe from all)'
  )
  .action(async (packageName?: string) => {
    try {
      await CommandService.unsubscribe(packageName);
    } catch (error) {
      DR.logger.error(`Failed to unsubscribe: ${String(error)}`);
      process.exit(1);
    }
  });

// Utility commands for debugging and management
program
  .command('list')
  .description('List all packages in the local registry and their subscribers')
  .action(async () => {
    try {
      const store = await LocalPackageStoreService.getStore();

      if (Object.keys(store.packages).length === 0) {
        DR.logger.info('No packages in local registry');
        return;
      }

      DR.logger.info('Local Registry Packages:');
      for (const [packageName, entry] of Object.entries(store.packages)) {
        if (!entry) {
          DR.logger.warn(`Package ${packageName} has no entry in the store`);
          continue;
        }
        DR.logger.info(`${packageName}:`);
        DR.logger.info(`  Original Version: ${entry.originalVersion}`);
        DR.logger.info(`  Current Version: ${entry.currentVersion}`);
        DR.logger.info(`  Subscribers (${entry.subscribers.length}):`);
        if (entry.subscribers.length === 0) {
          DR.logger.info('    (none)');
        } else {
          entry.subscribers.forEach((sub) => {
            DR.logger.info(`    - ${sub}`);
          });
        }
      }
    } catch (error) {
      DR.logger.error(`Failed to list packages: ${String(error)}`);
      process.exit(1);
    }
  });

program
  .command('get-store')
  .description('Gets the current local package store.')
  .action(async () => {
    try {
      const store = await LocalPackageStoreService.getStore();
      DR.logger.info(JSON.stringify(store, null, 2));
    } catch (error) {
      DR.logger.error(`Failed to get store: ${String(error)}`);
      process.exit(1);
    }
  });

// Configuration commands
program
  .command('config')
  .description('Shows the current configuration and config file location.')
  .action(async () => {
    try {
      const config = await ConfigService.loadConfig();
      const configPath = ConfigService.getConfigFilePath();

      DR.logger.info('Current Configuration:');
      DR.logger.info(JSON.stringify(config, null, 2));
      DR.logger.info('Configuration file location:');
      DR.logger.info(
        configPath || 'No configuration file found (using defaults)'
      );
    } catch (error) {
      DR.logger.error(`Failed to get config: ${String(error)}`);
      process.exit(1);
    }
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
