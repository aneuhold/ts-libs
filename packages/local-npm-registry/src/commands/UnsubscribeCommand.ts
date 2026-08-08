import { DR } from '@aneuhold/core-ts-lib';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { PackageJsonService } from '../services/PackageJson.service.js';
import { PackageManagerService } from '../services/PackageManagerService/PackageManager.service.js';
import { MutexLockName } from '../types/MutexLockName.js';

/**
 * Implements the 'local-npm unsubscribe [<package-name>]' command.
 */
export class UnsubscribeCommand {
  /**
   * Implements the 'local-npm unsubscribe [<package-name>]' command.
   *
   * @param packageName - Optional package name to unsubscribe from. If not provided, unsubscribes from all packages
   */
  static async execute(packageName?: string): Promise<void> {
    const currentProjectPath = process.cwd();

    if (packageName) {
      // Unsubscribe from specific package
      await this.#unsubscribeFromSpecificPackage(packageName, currentProjectPath);
    } else {
      // Unsubscribe from all packages
      await this.#unsubscribeFromAllPackages(currentProjectPath);
    }
  }

  /**
   * Unsubscribes from a specific package.
   *
   * @param packageName - Name of the package to unsubscribe from
   * @param currentProjectPath - Path to the current project
   */
  static async #unsubscribeFromSpecificPackage(
    packageName: string,
    currentProjectPath: string
  ): Promise<void> {
    const subscribersOriginalSpecifier = await MutexService.withLock(
      MutexLockName.Store,
      async () => {
        const store = await LocalPackageStoreService.getStore();
        const subscriptions = LocalPackageStoreService.getSubscriptionsForSubscriber(
          store,
          currentProjectPath
        );
        const subscription = subscriptions.find(
          (candidate) => candidate.packageName === packageName
        );
        if (!subscription) {
          const pathEntries = LocalPackageStoreService.getPackagePathEntries(store, packageName);
          if (Object.keys(pathEntries).length === 0) {
            throw new Error(`Package '${packageName}' not found in local registry`);
          }
          throw new Error(`Subscriber data not found for ${packageName}`);
        }

        // Remove current project from subscribers list
        LocalPackageStoreService.removeSubscriber(
          store,
          packageName,
          subscription.packagePath,
          currentProjectPath
        );
        await LocalPackageStoreService.writeStore(store);

        return subscription.subscribersOriginalSpecifier;
      }
    );

    // Reset to original version
    await PackageJsonService.updatePackageVersion(
      currentProjectPath,
      packageName,
      subscribersOriginalSpecifier
    );

    try {
      await PackageManagerService.runInstall(currentProjectPath);
    } catch (error) {
      DR.logger.warn(
        `Install failed after unsubscribing from ${packageName}: ${String(error)}. The package.json has been reset successfully.`
      );
    }

    DR.logger.info(`Successfully unsubscribed from ${packageName}`);
  }

  /**
   * Unsubscribes from all packages.
   *
   * @param currentProjectPath - Path to the current project
   */
  static async #unsubscribeFromAllPackages(currentProjectPath: string): Promise<void> {
    const subscriptions = await MutexService.withLock(MutexLockName.Store, async () => {
      const store = await LocalPackageStoreService.getStore();
      const found = LocalPackageStoreService.getSubscriptionsForSubscriber(
        store,
        currentProjectPath
      );

      for (const { packageName, packagePath } of found) {
        LocalPackageStoreService.removeSubscriber(
          store,
          packageName,
          packagePath,
          currentProjectPath
        );
      }

      if (found.length > 0) {
        await LocalPackageStoreService.writeStore(store);
      }

      return found;
    });

    if (subscriptions.length === 0) {
      DR.logger.info('No packages to unsubscribe from');
      return;
    }

    DR.logger.info(`Unsubscribing from ${subscriptions.length} package(s)`);

    let successCount = 0;

    for (const { packageName, subscribersOriginalSpecifier } of subscriptions) {
      try {
        // Reset to original version using subscriber's original specifier
        await PackageJsonService.updatePackageVersion(
          currentProjectPath,
          packageName,
          subscribersOriginalSpecifier
        );

        successCount += 1;
      } catch (error) {
        DR.logger.error(`Failed to unsubscribe from ${packageName}: ${String(error)}`);
      }
    }

    DR.logger.info(`Unsubscribe completed: ${successCount}/${subscriptions.length} successful`);

    // Run install once after all updates
    try {
      await PackageManagerService.runInstall(currentProjectPath);
    } catch (error) {
      DR.logger.warn(
        `Install failed after unsubscribing from all packages: ${String(error)}. The package.json files have been reset successfully.`
      );
    }

    DR.logger.info(`Successfully unsubscribed from all packages`);
  }
}
