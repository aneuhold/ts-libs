import { DR } from '@aneuhold/core-ts-lib';
import { CommandUtilService } from '../services/CommandUtil.service.js';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { PackageJsonService } from '../services/PackageJson.service.js';
import { VerdaccioService } from '../services/Verdaccio.service.js';
import { MutexLockName } from '../types/MutexLockName.js';

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
    await MutexService.withLock(MutexLockName.Store, async () => {
      const store = await LocalPackageStoreService.getStore();
      const existingEntry = LocalPackageStoreService.getPackageEntry(
        store,
        packageName,
        packagePath
      );

      // Prefer to use existing entry's original version if it exists. This helps
      // prevent a bug where the current package.json version has a timestamp.
      const originalVersion = existingEntry
        ? existingEntry.originalVersion
        : currentPackageJsonVersion;

      // Start Verdaccio server
      await VerdaccioService.start();

      const existingSubscribers = existingEntry?.subscribers || [];

      // Publish package and update subscribers
      await CommandUtilService.publishAndUpdateSubscribers(
        store,
        packageName,
        packagePath,
        originalVersion,
        existingSubscribers,
        undefined,
        additionalArgs
      );

      if (existingSubscribers.length === 0) {
        DR.logger.info('No subscribers to update');
      }

      await VerdaccioService.stop();
    });
  }
}
