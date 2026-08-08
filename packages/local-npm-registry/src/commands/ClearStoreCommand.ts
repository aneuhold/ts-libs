import { DR } from '@aneuhold/core-ts-lib';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { PackageJsonService } from '../services/PackageJson.service.js';
import { PackageManagerService } from '../services/PackageManagerService/PackageManager.service.js';
import { MutexLockName } from '../types/MutexLockName.js';

/**
 * Implements the 'local-npm clear-store' command.
 */
export class ClearStoreCommand {
  /**
   * Implements the 'local-npm clear-store' command.
   * Unpublishes all packages and unsubscribes all subscribers.
   */
  static async execute(): Promise<void> {
    await MutexService.withLock(MutexLockName.Store, async () => {
      const store = await LocalPackageStoreService.getStore();
      const packageNames = Object.keys(store.packages);

      if (packageNames.length === 0) {
        DR.logger.info('No packages in local registry to clear');
        return;
      }

      DR.logger.info(`Clearing ${packageNames.length} package(s) from local registry`);

      // One consumer can be bound to several packages, so the resets are grouped
      // by consumer to keep it to a single install each
      const resetsBySubscriber = new Map<
        string,
        { packageName: string; originalSpecifier: string }[]
      >();

      for (const [packageName, pathEntries] of Object.entries(store.packages)) {
        DR.logger.info(`Processing package: ${packageName}`);

        for (const entry of Object.values(pathEntries ?? {})) {
          for (const subscriber of entry?.subscribers ?? []) {
            const resets = resetsBySubscriber.get(subscriber.subscriberPath) ?? [];
            resets.push({ packageName, originalSpecifier: subscriber.originalSpecifier });
            resetsBySubscriber.set(subscriber.subscriberPath, resets);
          }
        }
      }

      if (resetsBySubscriber.size === 0) {
        LocalPackageStoreService.clearStore(store);
        await LocalPackageStoreService.writeStore(store);
        DR.logger.info(`Successfully cleared all ${packageNames.length} package(s)`);
        return;
      }

      DR.logger.info(`Resetting ${resetsBySubscriber.size} consumer(s) in parallel`);

      const resetPromises = Array.from(resetsBySubscriber, async ([subscriberPath, resets]) => {
        try {
          for (const reset of resets) {
            await PackageJsonService.updatePackageVersion(
              subscriberPath,
              reset.packageName,
              reset.originalSpecifier
            );
          }
          await PackageManagerService.runInstall(subscriberPath);
          DR.logger.info(`✓ Reset ${resets.length} package(s) in ${subscriberPath}`);
          return true;
        } catch (error) {
          DR.logger.error(`✗ Failed to reset ${subscriberPath}: ${String(error)}`);
          return false;
        }
      });

      const results = await Promise.allSettled(resetPromises);
      const successCount = results.filter(
        (result) => result.status === 'fulfilled' && result.value
      ).length;
      const errorCount = resetsBySubscriber.size - successCount;

      DR.logger.info(
        `Parallel reset completed: ${successCount}/${resetsBySubscriber.size} successful`
      );

      // Clear the entire store
      LocalPackageStoreService.clearStore(store);
      await LocalPackageStoreService.writeStore(store);

      if (errorCount > 0) {
        DR.logger.warn(
          `Cleared ${packageNames.length} package(s) with ${errorCount} consumer reset error(s)`
        );
      } else {
        DR.logger.info(
          `Successfully cleared all ${packageNames.length} package(s) and reset all subscribers`
        );
      }
    });
  }
}
