import { DR } from '@aneuhold/core-ts-lib';
import { LocalPackagePublisherService } from '../services/LocalPackagePublisher.service.js';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { LocalPackageVersionService } from '../services/LocalPackageVersion.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { PackageJsonService } from '../services/PackageJson.service.js';
import { VerdaccioService } from '../services/Verdaccio.service.js';

/**
 * Implements the 'local-npm subscribe <package-name>' command.
 */
export class SubscribeCommand {
  /**
   * Implements the 'local-npm subscribe <package-name>' command.
   *
   * Which directory a subscriber wants cannot be inferred from the subscriber, and
   * binding to the wrong one leaves it testing against a build it never asked
   * for with nothing to show for it, so a package published from several
   * directories has to be given one rather than prompted for it.
   *
   * @param packageName - Name of the package to subscribe to
   * @param packagePath - Directory the package is published from, which is required when it is published from several
   */
  static async execute(packageName: string, packagePath?: string): Promise<void> {
    const currentProjectPath = process.cwd();

    const freshVersion = await MutexService.withLock(async () => {
      const store = await LocalPackageStoreService.getStore();
      const resolvedPackagePath = LocalPackageStoreService.getPackagePath(
        store,
        packageName,
        packagePath
      );
      const entry = LocalPackageStoreService.getPackageEntry(
        store,
        packageName,
        resolvedPackagePath
      );
      if (!entry) {
        throw new Error(
          `Package '${packageName}' is not being published (or no longer published) from ${resolvedPackagePath}`
        );
      }

      // Get the current specifier from package.json to save as original
      const currentSpecifier = await PackageJsonService.getCurrentPackageVersionSpecifier(
        currentProjectPath,
        packageName
      );
      if (!currentSpecifier) {
        throw new Error(
          `Package '${packageName}' not found in current project's dependencies. Please add it to package.json first.`
        );
      }

      // A subscriber can only subscribe to a package once. So this checks if the package is already
      // subbed to on a different path that the one provided.
      const packageSubscribedOnAnotherPath = LocalPackageStoreService.getSubscriptionsForSubscriber(
        store,
        currentProjectPath
      ).find(
        (subscription) =>
          subscription.packageName === packageName &&
          subscription.packagePath !== resolvedPackagePath
      );
      // A reset this tool could not finish leaves a subscriber holding a version
      // only the local registry resolves, and recording that as what to put the
      // subscriber back on would leave it unresolvable once it unsubscribes
      const specifierToRecord = LocalPackageVersionService.versionStringIsForLocalPackage(
        currentSpecifier,
        resolvedPackagePath
      )
        ? entry.originalVersion
        : currentSpecifier;
      const originalSpecifier =
        packageSubscribedOnAnotherPath?.originalSpecifier ?? specifierToRecord;

      if (packageSubscribedOnAnotherPath) {
        DR.logger.info(
          `Moving the subscription to ${packageName} from ${packageSubscribedOnAnotherPath.packagePath} to ${resolvedPackagePath}`
        );
        LocalPackageStoreService.removeSubscriber(
          store,
          packageName,
          packageSubscribedOnAnotherPath.packagePath,
          currentProjectPath
        );
      }

      // Start Verdaccio server
      await VerdaccioService.start();

      try {
        // Publish package and update subscribers
        return await LocalPackagePublisherService.publishWithDependentsAndUpdateSubscribers(
          store,
          { packageName, packagePath: resolvedPackagePath },
          entry.originalVersion,
          {
            additionalSubscriber: {
              subscriberPath: currentProjectPath,
              originalSpecifier
            },
            // Use stored publish args from when package was originally published
            additionalPublishArgs: entry.publishArgs ?? []
          }
        );
      } finally {
        await VerdaccioService.stop();
      }
    });

    DR.logger.info(`Successfully subscribed to ${packageName}@${freshVersion}`);
  }
}
