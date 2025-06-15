import { DR } from '@aneuhold/core-ts-lib';
import { CommandUtilService } from '../services/CommandUtilService.js';
import { LocalPackageStoreService } from '../services/LocalPackageStoreService.js';
import { PackageJsonService } from '../services/PackageJsonService.js';
import { VerdaccioService } from '../services/VerdaccioService.js';

/**
 * Implements the 'local-npm publish' command.
 */
export class PublishCommand {
  /**
   * Implements the 'local-npm publish' command.
   */
  static async execute(): Promise<void> {
    const packageInfo = await PackageJsonService.getPackageInfo();
    if (!packageInfo) {
      throw new Error('No package.json found in current directory');
    }

    const { name: packageName, version: currentPackageJsonVersion } =
      packageInfo;

    const existingEntry =
      await LocalPackageStoreService.getPackageEntry(packageName);

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
      packageName,
      process.cwd(),
      originalVersion,
      existingSubscribers
    );

    if (existingSubscribers.length === 0) {
      DR.logger.info('No subscribers to update');
    }

    await VerdaccioService.stop();
  }
}
