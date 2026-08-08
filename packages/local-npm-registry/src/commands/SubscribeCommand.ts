import { DR } from '@aneuhold/core-ts-lib';
import { CommandUtilService } from '../services/CommandUtil.service.js';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { PackageJsonService } from '../services/PackageJson.service.js';
import { VerdaccioService } from '../services/Verdaccio.service.js';
import { MutexLockName } from '../types/MutexLockName.js';

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
    const currentProjectPath = process.cwd();

    const freshVersion = await MutexService.withLock(MutexLockName.Store, async () => {
      const store = await LocalPackageStoreService.getStore();
      const packagePath = LocalPackageStoreService.getPackagePath(store, packageName);
      const entry = LocalPackageStoreService.getPackageEntry(store, packageName, packagePath);
      if (!entry) {
        throw new Error(`Package '${packageName}' is no longer published from ${packagePath}`);
      }

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
      const publishedVersion = await CommandUtilService.publishAndUpdateSubscribers(
        store,
        packageName,
        packagePath,
        entry.originalVersion,
        entry.subscribers,
        { subscriberPath: currentProjectPath, originalSpecifier },
        entry.publishArgs || [] // Use stored publish args from when package was originally published
      );

      await VerdaccioService.stop();

      return publishedVersion;
    });

    DR.logger.info(`Successfully subscribed to ${packageName}@${freshVersion}`);
  }
}
