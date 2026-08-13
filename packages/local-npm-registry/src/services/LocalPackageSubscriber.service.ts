import { DR } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import type {
  LocalPackageStore,
  PackageSubscriber,
  PackageSubscription
} from '../types/LocalPackageStore.js';
import { LocalPackageStoreService } from './LocalPackageStore.service.js';
import { PackageJsonService } from './PackageJson.service.js';
import { PackageManagerService } from './PackageManagerService/PackageManager.service.js';
import { VerdaccioService } from './Verdaccio.service.js';

/**
 * Service for the projects that subscribe to a locally published package, which
 * owns the specifier each one holds for that package and the install that
 * follows a change to it.
 */
export class LocalPackageSubscriberService {
  /**
   * Points every {@link PackageSubscriber} of a package at a version and
   * installs it, dropping the ones whose project directory is gone.
   *
   * Every subscriber is attempted before any failure is reported, so one broken
   * subscriber cannot hide the rest.
   *
   * @param store - The store the dropped subscribers are removed from
   * @param packageName - Name of the package the subscribers are updated to
   * @param packagePath - Path the package is published from
   * @param subscribers - The subscribers recorded for that path
   * @param version - The version to point them at
   */
  static async updateSubscribersToVersion(
    store: LocalPackageStore,
    packageName: string,
    packagePath: string,
    subscribers: PackageSubscriber[],
    version: string
  ): Promise<void> {
    const liveSubscribers = await this.#deleteSubscribersWithMissingDirectories(
      store,
      packageName,
      packagePath,
      subscribers
    );

    if (liveSubscribers.length === 0) {
      return;
    }

    DR.logger.info(`Updating ${liveSubscribers.length} subscriber(s)`);

    const results = await Promise.allSettled(
      liveSubscribers.map(async ({ subscriberPath }) => {
        await PackageJsonService.updatePackageVersion(subscriberPath, packageName, version);
        await PackageManagerService.runInstallWithRegistry(subscriberPath, store);
      })
    );

    const failures = results.flatMap((result, index) =>
      result.status === 'rejected'
        ? [`  ${liveSubscribers[index].subscriberPath}: ${String(result.reason)}`]
        : []
    );

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} of ${liveSubscribers.length} subscriber(s) could not be updated to ${packageName}@${version}:\n${failures.join('\n')}`
      );
    }
  }

  /**
   * Takes each {@link PackageSubscription} out of the store, rewrites the
   * subscriber's dependency back to the
   * {@link PackageSubscriber.originalSpecifier} it held, and reinstalls it.
   *
   * Verdaccio runs for this call.
   *
   * @param store - The store the subscriptions are removed from
   * @param subscriptions - The subscriptions being undone
   */
  static async resetPackageSubscriptions(
    store: LocalPackageStore,
    subscriptions: PackageSubscription[]
  ): Promise<void> {
    // Remove the subscribers from the store
    for (const { packageName, packagePath, subscriberPath } of subscriptions) {
      LocalPackageStoreService.removeSubscriber(store, packageName, packagePath, subscriberPath);
    }
    await LocalPackageStoreService.writeStore(store);

    const subscriberPathToSubscriptions = this.#groupBySubscriberPath(subscriptions);

    await VerdaccioService.start();
    try {
      for (const [subscriberPath, subscriberSubscriptions] of subscriberPathToSubscriptions) {
        try {
          for (const { packageName, originalSpecifier } of subscriberSubscriptions) {
            await PackageJsonService.updatePackageVersion(
              subscriberPath,
              packageName,
              originalSpecifier
            );
          }

          // Only run the install with the registry if there are still active subscriptions for
          // a particular path. Otherwise install like normal.
          if (
            LocalPackageStoreService.getSubscriptionsForSubscriber(store, subscriberPath).length > 0
          ) {
            await PackageManagerService.runInstallWithRegistry(subscriberPath, store);
          } else {
            await PackageManagerService.runInstall(subscriberPath);
          }

          DR.logger.info(`Reset ${subscriberSubscriptions.length} package(s) in ${subscriberPath}`);
        } catch (error) {
          DR.logger.error(`Failed to reset subscriber ${subscriberPath}: ${String(error)}`);
        }
      }
    } finally {
      await VerdaccioService.stop();
    }
  }

  /**
   * How many {@link PackageSubscriber.subscriberPath}s a set of
   * {@link PackageSubscription}s resets, which is what a command reports rather
   * than the number of subscriptions.
   *
   * @param subscriptions - The subscriptions being undone
   */
  static countSubscribers(subscriptions: PackageSubscription[]): number {
    return this.#groupBySubscriberPath(subscriptions).size;
  }

  /**
   * Collects {@link PackageSubscription}s by the
   * {@link PackageSubscriber.subscriberPath} they belong to, which is the key
   * of the returned map.
   *
   * @param subscriptions - The subscriptions to group
   */
  static #groupBySubscriberPath(
    subscriptions: PackageSubscription[]
  ): Map<string, PackageSubscription[]> {
    const bySubscriber = new Map<string, PackageSubscription[]>();

    for (const subscription of subscriptions) {
      const forSubscriber = bySubscriber.get(subscription.subscriberPath) ?? [];
      forSubscriber.push(subscription);
      bySubscriber.set(subscription.subscriberPath, forSubscriber);
    }

    return bySubscriber;
  }

  /**
   * Removes the subscribers whose project directory is gone, returning the ones
   * that are left.
   *
   * @param store - The store the subscribers are removed from
   * @param packageName - Name of the package being published
   * @param packagePath - Path of the package being published
   * @param subscribers - The subscribers recorded for that path
   */
  static async #deleteSubscribersWithMissingDirectories(
    store: LocalPackageStore,
    packageName: string,
    packagePath: string,
    subscribers: PackageSubscriber[]
  ): Promise<PackageSubscriber[]> {
    const subscriberDirectories = await Promise.all(
      subscribers.map(async (subscriber) => ({
        subscriber,
        directoryExists: await fs.pathExists(subscriber.subscriberPath)
      }))
    );

    const missingSubscribers = subscriberDirectories
      .filter(({ directoryExists }) => !directoryExists)
      .map(({ subscriber }) => subscriber);

    if (missingSubscribers.length === 0) {
      return subscribers;
    }

    for (const { subscriberPath } of missingSubscribers) {
      DR.logger.warn(`Dropping subscriber ${subscriberPath}, whose directory no longer exists`);
      LocalPackageStoreService.removeSubscriber(store, packageName, packagePath, subscriberPath);
    }
    await LocalPackageStoreService.writeStore(store);

    return subscriberDirectories
      .filter(({ directoryExists }) => directoryExists)
      .map(({ subscriber }) => subscriber);
  }
}
