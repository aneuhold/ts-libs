import { DR } from '@aneuhold/core-ts-lib';
import { LocalPackageStoreService } from '../services/LocalPackageStoreService.js';
import { PackageJsonService } from '../services/PackageJsonService.js';
import { PackageManagerService } from '../services/PackageManagerService/PackageManagerService.js';
import { VerdaccioService } from '../services/VerdaccioService.js';

/**
 * Implements the 'local-npm unpublish <package-name>' command.
 */
export class UnpublishCommand {
  /**
   * Implements the 'local-npm unpublish <package-name>' command.
   *
   * @param packageName - Optional package name to unpublish. If not provided, uses current directory's package.json
   */
  static async execute(packageName?: string): Promise<void> {
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

    const entry = await LocalPackageStoreService.getPackageEntry(targetPackageName);
    if (!entry) {
      throw new Error(`Package '${targetPackageName}' not found in local registry`);
    }

    // Reset all subscribers to original version
    if (entry.subscribers.length > 0) {
      DR.logger.info(`Resetting ${entry.subscribers.length} subscriber(s) to original version`);

      for (const subscriber of entry.subscribers) {
        try {
          await PackageJsonService.updatePackageVersion(
            subscriber.subscriberPath,
            targetPackageName,
            subscriber.originalSpecifier
          );
          await PackageManagerService.runInstall(subscriber.subscriberPath);
        } catch (error) {
          DR.logger.error(
            `Failed to reset subscriber ${subscriber.subscriberPath}: ${String(error)}`
          );
        }
      }
    }

    // Reset current package.json to original version if we're in the package directory
    if (!packageName) {
      await PackageJsonService.updatePackageVersion(
        process.cwd(),
        targetPackageName,
        entry.originalVersion
      );
    }

    // Remove package from local store
    await LocalPackageStoreService.removePackage(targetPackageName);

    // Unpublish from Verdaccio
    await VerdaccioService.unpublishPackage(targetPackageName);

    DR.logger.info(`Successfully unpublished ${targetPackageName} and reset all subscribers`);
  }
}
