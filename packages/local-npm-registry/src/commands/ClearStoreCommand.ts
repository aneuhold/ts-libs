import { DR } from '@aneuhold/core-ts-lib';
import { CommandUtilService } from '../services/CommandUtil.service.js';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { VerdaccioService } from '../services/Verdaccio.service.js';
import type { PackageSubscription } from '../types/LocalPackageStore.js';

/**
 * Implements the 'local-npm clear-store' command.
 */
export class ClearStoreCommand {
  /**
   * Implements the 'local-npm clear-store' command.
   * Unpublishes all packages and unsubscribes all subscribers.
   */
  static async execute(): Promise<void> {
    await MutexService.withLock(async () => {
      const store = await LocalPackageStoreService.getStore();
      const packageCount = Object.keys(store.packages).length;

      if (packageCount === 0) {
        DR.logger.info('No packages in local registry to clear');
        return;
      }

      DR.logger.info(`Clearing ${packageCount} package(s) from local registry`);

      // Collected before the store is emptied, since the store is what says
      // what each subscriber has to be put back to
      const subscriptions: PackageSubscription[] = [];
      for (const [packageName, pathEntries] of Object.entries(store.packages)) {
        for (const [packagePath, entry] of Object.entries(pathEntries ?? {})) {
          subscriptions.push(
            ...(entry?.subscribers ?? []).map((subscriber) => ({
              ...subscriber,
              packageName,
              packagePath
            }))
          );
        }
      }

      LocalPackageStoreService.clearStore(store);
      await LocalPackageStoreService.writeStore(store);

      const subscriberCount = CommandUtilService.countSubscribers(subscriptions);
      if (subscriberCount > 0) {
        DR.logger.info(`Resetting ${subscriberCount} subscriber(s)`);
      }

      await CommandUtilService.resetPackageSubscriptions(store, subscriptions);

      // Nothing points at anything the registry holds any more, which makes this
      // where the versions every other command left behind are collected
      await VerdaccioService.clearStorage();

      DR.logger.info(`Successfully cleared all ${packageCount} package(s)`);
    });
  }
}
