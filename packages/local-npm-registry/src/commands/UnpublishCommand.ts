import { DR } from '@aneuhold/core-ts-lib';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { LocalPackageSubscriberService } from '../services/LocalPackageSubscriber.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { PackageJsonService } from '../services/PackageJson.service.js';
import { VerdaccioService } from '../services/Verdaccio.service.js';
import type { LocalPackageStore, PackageSubscription } from '../types/LocalPackageStore.js';

/**
 * Implements the 'local-npm unpublish [package-name]' command.
 */
export class UnpublishCommand {
  /**
   * Implements the 'local-npm unpublish [package-name]' command.
   *
   * @param packageName - Optional package name to unpublish. If not provided, uses current directory's package.json
   * @param packagePath - The directory to unpublish, which has to be one the package is published from
   * @param allPaths - Unpublish every directory the package is published from
   */
  static async execute(
    packageName?: string,
    packagePath?: string,
    allPaths = false
  ): Promise<void> {
    let targetPackageName: string;

    if (packageName) {
      targetPackageName = packageName;
    } else {
      const packageInfo = await PackageJsonService.getPackageInfo();
      if (!packageInfo) {
        throw new Error('No package.json found in current directory and no package name provided');
      }
      targetPackageName = packageInfo.name;
    }

    await MutexService.withLock(async () => {
      const store = await LocalPackageStoreService.getStore();
      const packagePathsToUnpublish = this.#resolvePublishedPackagePathsToUnpublish(
        store,
        targetPackageName,
        packagePath,
        allPaths
      );
      const unpublishedPaths: string[] = [];
      const subscriptions: PackageSubscription[] = [];

      for (const targetPath of packagePathsToUnpublish) {
        const entry = LocalPackageStoreService.getPackageEntry(
          store,
          targetPackageName,
          targetPath
        );
        if (!entry) {
          continue;
        }

        // Revert the package version if it is a local one.
        await PackageJsonService.updatePackageVersionIfLocal(
          targetPath,
          targetPackageName,
          entry.originalVersion
        );

        unpublishedPaths.push(targetPath);
        subscriptions.push(
          ...entry.subscribers.map((subscriber) => ({
            ...subscriber,
            packageName: targetPackageName,
            packagePath: targetPath
          }))
        );

        LocalPackageStoreService.removePackagePath(store, targetPackageName, targetPath);
      }

      await LocalPackageStoreService.writeStore(store);

      for (const unpublishedPath of unpublishedPaths) {
        await VerdaccioService.removeVersionsPublishedFrom(targetPackageName, unpublishedPath);
      }

      const subscriberCount = LocalPackageSubscriberService.countSubscribers(subscriptions);
      if (subscriberCount > 0) {
        DR.logger.info(`Resetting ${subscriberCount} subscriber(s) to original version`);
      }

      await LocalPackageSubscriberService.resetPackageSubscriptions(store, subscriptions);

      DR.logger.info(`Successfully unpublished ${targetPackageName} and reset all subscribers`);
    });
  }

  /**
   * Resolves which publishing directories the command acts on.
   *
   * @param store - The store to resolve against
   * @param packageName - Name of the package to unpublish
   * @param packagePath - The directory to unpublish, which has to be one the package is published from
   * @param allPaths - Unpublish every directory the package is published from
   */
  static #resolvePublishedPackagePathsToUnpublish(
    store: LocalPackageStore,
    packageName: string,
    packagePath: string | undefined,
    allPaths: boolean
  ): string[] {
    const packagePathEntries = LocalPackageStoreService.getPackagePathEntries(store, packageName);

    if (Object.keys(packagePathEntries).length === 0) {
      throw new Error(`No entries for package '${packageName}' found in local registry`);
    }

    // If all paths, then take all the publishing directories.
    if (allPaths) {
      return Object.keys(packagePathEntries);
    }

    // If the packagePath was not specified, then return the current directory if it is the one
    // being unpublished.
    if (!packagePath && packagePathEntries[process.cwd()]) {
      return [process.cwd()];
    }

    // Otherwise, take the one explicitly specified.
    return [LocalPackageStoreService.getPackagePath(store, packageName, packagePath)];
  }
}
