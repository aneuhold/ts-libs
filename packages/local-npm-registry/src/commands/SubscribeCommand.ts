import { DR } from '@aneuhold/core-ts-lib';
import { CommandUtilService } from '../services/CommandUtilService.js';
import { LocalPackageStoreService } from '../services/LocalPackageStoreService.js';
import { PackageJsonService } from '../services/PackageJsonService.js';
import { VerdaccioService } from '../services/VerdaccioService.js';

/**
 * Implements the 'local-npm subscribe <package-name>' command.
 */
export class SubscribeCommand {
  /**
   * Implements the 'local-npm subscribe <package-name>' command.
   *
   * @param packageName - Name of the package to subscribe to
   */
  static async execute(packageName: string): Promise<void> {
    const entry = await LocalPackageStoreService.getPackageEntry(packageName);

    if (!entry) {
      const store = await LocalPackageStoreService.getStore();
      const availablePackages = Object.keys(store.packages);
      if (availablePackages.length > 0) {
        throw new Error(
          `Package '${packageName}' not found. Available packages: ${availablePackages.join(', ')}`
        );
      }
      throw new Error('No packages found in local registry');
    }

    const currentProjectPath = process.cwd();

    // Get the current specifier from package.json to save as original
    const originalSpecifier = await PackageJsonService.getCurrentSpecifier(
      currentProjectPath,
      packageName
    );
    if (!originalSpecifier) {
      throw new Error(
        `Package '${packageName}' not found in current project's dependencies. Please add it to package.json first.`
      );
    }

    // Start Verdaccio server
    await VerdaccioService.start();

    // Publish package and update subscribers
    const freshVersion = await CommandUtilService.publishAndUpdateSubscribers(
      packageName,
      entry.packageRootPath,
      entry.originalVersion,
      entry.subscribers,
      { subscriberPath: currentProjectPath, originalSpecifier },
      entry.publishArgs || [] // Use stored publish args from when package was originally published
    );

    await VerdaccioService.stop();

    DR.logger.info(`Successfully subscribed to ${packageName}@${freshVersion}`);
  }
}
