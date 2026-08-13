import { DR } from '@aneuhold/core-ts-lib';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { LocalPackageSubscriberService } from '../services/LocalPackageSubscriber.service.js';
import { MutexService } from '../services/Mutex.service.js';
import type { LocalPackageStore, PackageSubscription } from '../types/LocalPackageStore.js';

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

    await MutexService.withLock(async () => {
      const store = await LocalPackageStoreService.getStore();
      const subscriptions = packageName
        ? [this.#getSubscriptionToPackage(store, currentProjectPath, packageName)]
        : LocalPackageStoreService.getSubscriptionsForSubscriber(store, currentProjectPath);

      if (subscriptions.length === 0) {
        DR.logger.info('No packages to unsubscribe from');
        return;
      }

      DR.logger.info(`Unsubscribing from ${subscriptions.length} package(s)`);

      await LocalPackageSubscriberService.resetPackageSubscriptions(store, subscriptions);

      DR.logger.info(
        packageName
          ? `Successfully unsubscribed from ${packageName}`
          : 'Successfully unsubscribed from all packages'
      );
    });
  }

  /**
   * The project's subscription to a single package, which has to exist for
   * there to be anything to undo.
   *
   * @param store - The store to read the subscription from
   * @param subscriberPath - Path of the project holding the subscription
   * @param packageName - Name of the package being unsubscribed from
   */
  static #getSubscriptionToPackage(
    store: LocalPackageStore,
    subscriberPath: string,
    packageName: string
  ): PackageSubscription {
    const subscription = LocalPackageStoreService.getSubscriptionsForSubscriber(
      store,
      subscriberPath
    ).find((candidate) => candidate.packageName === packageName);

    if (subscription) {
      return subscription;
    }

    const pathEntries = LocalPackageStoreService.getPackagePathEntries(store, packageName);
    if (Object.keys(pathEntries).length === 0) {
      throw new Error(`Package '${packageName}' not found in local registry`);
    }
    throw new Error(`Subscriber data not found for ${packageName}`);
  }
}
