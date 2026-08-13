import { DR } from '@aneuhold/core-ts-lib';
import { LocalPackagePublisherService } from '../services/LocalPackagePublisher.service.js';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { LocalPackageVersionService } from '../services/LocalPackageVersion.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { PackageJsonService } from '../services/PackageJson.service.js';
import { VerdaccioService } from '../services/Verdaccio.service.js';

/**
 * Implements the 'local-npm publish' command.
 */
export class PublishCommand {
  /**
   * Implements the 'local-npm publish' command.
   *
   * @param additionalArgs - Additional arguments to pass to the npm publish command
   */
  static async execute(additionalArgs: string[] = []): Promise<void> {
    const packageInfo = await PackageJsonService.getPackageInfo();
    if (!packageInfo) {
      throw new Error('No package.json found in current directory');
    }

    const { name: packageName, version: currentPackageJsonVersion } = packageInfo;

    const packagePath = process.cwd();

    // The entry read here is what the publish writes back, so the lock spans
    // both and a competing publish cannot land in between
    await MutexService.withLock(async () => {
      const store = await LocalPackageStoreService.getStore();
      const existingEntry = LocalPackageStoreService.getPackageEntry(
        store,
        packageName,
        packagePath
      );

      // The store is what holds the version this directory publishes under. A
      // publish killed before it writes the store leaves its timestamp version
      // in package.json, so what is read from there is stripped back down
      const originalVersion = existingEntry
        ? existingEntry.originalVersion
        : LocalPackageVersionService.removeSuffix(currentPackageJsonVersion);

      // Start Verdaccio server
      await VerdaccioService.start();

      // Publish the package, along with every locally published package that
      // depends on it, and update the subscribers of all of them
      await LocalPackagePublisherService.publishWithDependentsAndUpdateSubscribers(
        store,
        { packageName, packagePath },
        originalVersion,
        { additionalPublishArgs: additionalArgs }
      );

      if ((existingEntry?.subscribers ?? []).length === 0) {
        DR.logger.info('No subscribers to update');
      }

      await VerdaccioService.stop();
    });
  }
}
