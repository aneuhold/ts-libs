#!/usr/bin/env node --no-warnings

import { DR } from '@aneuhold/core-ts-lib';
import { program } from 'commander';
import { ConfigService } from './services/ConfigService.js';
import { LocalPackageInstallService } from './services/LocalPackageInstallService.js';
import { LocalPackageStoreService } from './services/LocalPackageStoreService.js';
import { PackageWatchService } from './services/PackageWatchService.js';
import { VerdaccioService } from './services/VerdaccioService.js';

program
  .name('local-npm')
  .description(
    'CLI to manage local npm package installations and updates for the ts-libs monorepo.'
  );

// Store management commands
program
  .command('get-store')
  .description('Gets the current local package store.')
  .action(async () => {
    const store = await LocalPackageStoreService.getStore();
    DR.logger.info(JSON.stringify(store, null, 2));
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

// Configuration commands
program
  .command('config')
  .description('Shows the current configuration and config file location.')
  .action(async () => {
    const config = await ConfigService.loadConfig();
    const configPath = ConfigService.getConfigFilePath();

    DR.logger.info('Current Configuration:');
    DR.logger.info(JSON.stringify(config, null, 2));
    DR.logger.info('\nConfiguration file location:');
    DR.logger.info(
      configPath || 'No configuration file found (using defaults)'
    );
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

// Verdaccio registry management commands
program
  .command('registry-status')
  .description('Shows the status of the local Verdaccio registry.')
  .action(async () => {
    const verdaccioService = VerdaccioService.getInstance();
    const status = await verdaccioService.getStatus();

    DR.logger.info('Registry Status:');
    DR.logger.info(JSON.stringify(status, null, 2));
  });

program
  .command('registry-start')
  .description('Starts the local Verdaccio registry.')
  .action(async () => {
    try {
      const verdaccioService = VerdaccioService.getInstance();
      await verdaccioService.start();
    } catch (error) {
      DR.logger.error(`Failed to start registry: ${String(error)}`);
      process.exit(1);
    }
  });

program
  .command('registry-stop')
  .description('Stops the local Verdaccio registry.')
  .action(async () => {
    try {
      const verdaccioService = VerdaccioService.getInstance();
      await verdaccioService.stop();
    } catch (error) {
      DR.logger.error(`Failed to stop registry: ${String(error)}`);
      process.exit(1);
    }
  });

// Package watching and building commands
program
  .command('watch')
  .description(
    'Starts watching packages for changes and automatically publishes them to the local registry.'
  )
  .option(
    '-p, --packages <packages...>',
    'Specific packages to watch (defaults to all packages)'
  )
  .action(async (options) => {
    const watchService = new PackageWatchService();

    try {
      const packageNames = options.packages || [];
      await watchService.startWatching(packageNames);

      // Keep the process running
      process.on('SIGINT', async () => {
        DR.logger.info('Received SIGINT, stopping watchers...');
        await watchService.stopWatching();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        DR.logger.info('Received SIGTERM, stopping watchers...');
        await watchService.stopWatching();
        process.exit(0);
      });

      // Keep the process alive
      await new Promise(() => {});
    } catch (error) {
      DR.logger.error(`Failed to start watching: ${String(error)}`);
      process.exit(1);
    }
  });

program
  .command('build')
  .description('Manually builds and publishes a package to the local registry.')
  .argument('<packageName>', 'The name of the package to build and publish.')
  .action(async (packageName: string) => {
    const watchService = new PackageWatchService();

    try {
      const result = await watchService.buildAndPublishPackage(packageName);
      if (result) {
        DR.logger.info(
          `Successfully built and published ${result.name}@${result.version}`
        );
      } else {
        DR.logger.error('Build and publish failed');
        process.exit(1);
      }
    } catch (error) {
      DR.logger.error(`Failed to build and publish: ${String(error)}`);
      process.exit(1);
    }
  });

// Local package installation commands
program
  .command('local-install')
  .description(
    'Installs a package from the local registry and sets up automatic updates.'
  )
  .argument('<packageName>', 'The name of the package to install locally.')
  .action(async (packageName: string) => {
    const installService = new LocalPackageInstallService();

    try {
      await installService.installLocalPackage(packageName);
    } catch (error) {
      DR.logger.error(`Failed to install local package: ${String(error)}`);
      process.exit(1);
    }
  });

program
  .command('local-uninstall')
  .description(
    'Removes a package from local watching and installs the production version.'
  )
  .argument('<packageName>', 'The name of the package to uninstall locally.')
  .action(async (packageName: string) => {
    const installService = new LocalPackageInstallService();

    try {
      await installService.uninstallLocalPackage(packageName);
    } catch (error) {
      DR.logger.error(`Failed to uninstall local package: ${String(error)}`);
      process.exit(1);
    }
  });

program
  .command('local-list')
  .description(
    'Lists all locally installed packages that are being watched for updates.'
  )
  .action(async () => {
    const installService = new LocalPackageInstallService();
    const watchedPackages = installService.getWatchedPackages();

    if (watchedPackages.length === 0) {
      DR.logger.info(
        'No packages are currently being watched for local updates.'
      );
    } else {
      DR.logger.info('Locally watched packages:');
      watchedPackages.forEach((pkg) => {
        DR.logger.info(`  - ${pkg}`);
      });
    }
  });

program
  .command('local-watch')
  .description('Starts watching for updates to locally installed packages.')
  .action(async () => {
    const installService = new LocalPackageInstallService();

    try {
      // This would typically be handled automatically by local-install,
      // but this command can be used to restart watching if needed
      DR.logger.info('Watching for local package updates...');

      process.on('SIGINT', async () => {
        DR.logger.info('Received SIGINT, stopping watcher...');
        await installService.stopWatching();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        DR.logger.info('Received SIGTERM, stopping watcher...');
        await installService.stopWatching();
        process.exit(0);
      });

      // Keep the process alive
      await new Promise(() => {});
    } catch (error) {
      DR.logger.error(`Failed to start watching: ${String(error)}`);
      process.exit(1);
    }
  });

program.parseAsync().catch((error: unknown) => {
  DR.logger.error(`Error executing command: ${String(error)}`);
  process.exit(1);
});
