import { DR } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { LocalPackageSubscriberService } from '../services/LocalPackageSubscriber.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { VerdaccioService } from '../services/Verdaccio.service.js';
import type { PackageSubscription } from '../types/LocalPackageStore.js';

/**
 * Implements the 'local-npm prune' command.
 */
export class PruneCommand {
  /**
   * Implements the 'local-npm prune' command, which reconciles the store with
   * what is actually on disk.
   *
   * Nothing else visits a publishing directory that was deleted: publish runs
   * from the current directory, which by definition exists, so its subscribers
   * would stay pinned to versions that can never resolve again.
   */
  static async execute(): Promise<void> {
    // The lock spans the registry removal and the installs as well as the store
    // write, since a command landing in between would publish versions this
    // sweep then takes, and would rewrite the same subscribers
    await MutexService.withLock(async () => {
      const store = await LocalPackageStoreService.getStore();
      const deadPaths: Array<{ packageName: string; packagePath: string }> = [];
      const subscriptions: PackageSubscription[] = [];

      // The directory is gone, but the store still holds its entry, which is
      // what names the versions to remove and the subscribers to put back
      for (const [packageName, pathEntries] of Object.entries(store.packages)) {
        for (const [packagePath, entry] of Object.entries(pathEntries ?? {})) {
          if (!entry || (await fs.pathExists(packagePath))) {
            continue;
          }

          DR.logger.info(`${packageName} is published from ${packagePath}, which no longer exists`);

          deadPaths.push({ packageName, packagePath });
          subscriptions.push(
            ...entry.subscribers.map((subscriber) => ({ ...subscriber, packageName, packagePath }))
          );

          LocalPackageStoreService.removePackagePath(store, packageName, packagePath);
        }
      }

      if (deadPaths.length === 0) {
        DR.logger.info('Every publishing directory in the local registry still exists');
        return;
      }

      await LocalPackageStoreService.writeStore(store);

      DR.logger.info(`Pruning ${deadPaths.length} publishing directory(s) that no longer exist`);

      for (const { packageName, packagePath } of deadPaths) {
        await VerdaccioService.removeVersionsPublishedFrom(packageName, packagePath);
      }

      await LocalPackageSubscriberService.resetPackageSubscriptions(store, subscriptions);

      DR.logger.info(`Successfully pruned ${deadPaths.length} publishing directory(s)`);
    });
  }
}
