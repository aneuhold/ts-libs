import { DR } from '@aneuhold/core-ts-lib';
import { createHash } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import {
  isLocalPackageStore,
  type LocalPackageStore,
  type PackageEntry,
  type PackagePathEntries
} from '../types/LocalPackageStore.js';
import { ConfigService } from './Config.service.js';

/**
 * Service to manage the local package store.
 *
 * Every method apart from `getStore` and `writeStore` works against a store the
 * caller already holds, so one read serves a whole operation and one write ends
 * it. A caller that reads and later writes has to hold `MutexLockName.Store`
 * across both, or a competing process can change the file in between and the
 * write puts back a store built from what the file no longer holds.
 */
export class LocalPackageStoreService {
  /**
   * Regular expression pattern for matching the suffix this tool appends to
   * package versions, which is a path slug and a timestamp.
   */
  static readonly #TIMESTAMP_PATTERN = /-p[0-9a-f]{8}\.\d{17}$/;

  static readonly #STORE_VERSION = 2;

  static readonly #STORE_FILE_NAME = 'local-package-store.json';

  /**
   * Reads the local package store from the file system.
   *
   * A store written under an older version is deprecated next to the store file
   * and an empty store is returned in its place.
   */
  static async getStore(): Promise<LocalPackageStore> {
    const storeFilePath = await this.#getStoreFilePath();

    if (!(await fs.pathExists(storeFilePath))) {
      return this.#createEmptyStore();
    }

    const rawStore: unknown = await fs.readJson(storeFilePath);

    if (!this.#storeDeclaresCorrectVersion(rawStore)) {
      await this.#deprecatePackageStore(storeFilePath);
      return this.#createEmptyStore();
    }

    if (!isLocalPackageStore(rawStore)) {
      throw new Error(
        `The local package store at ${storeFilePath} declares version ${this.#STORE_VERSION} but does not hold a valid store.`
      );
    }

    return rawStore;
  }

  /**
   * Writes the local package store to the file system.
   *
   * @param store - The store to write
   */
  static async writeStore(store: LocalPackageStore): Promise<void> {
    const storeFilePath = await this.#getStoreFilePath();

    try {
      await fs.writeJson(storeFilePath, store, { spaces: 2 });
    } catch (error) {
      throw new Error(`Failed to write the local package store: ${String(error)}`, {
        cause: error
      });
    }
  }

  /**
   * Gets every directory a package is published from, along with the entry each
   * one holds.
   *
   * @param store - The store to read
   * @param packageName - Name of the package to retrieve the entries of
   */
  static getPackagePathEntries(store: LocalPackageStore, packageName: string): PackagePathEntries {
    return store.packages[packageName] ?? {};
  }

  /**
   * Gets the entry for a package published from a given directory.
   *
   * @param store - The store to read
   * @param packageName - Name of the package to retrieve
   * @param packagePath - Resolved absolute path of the package
   */
  static getPackageEntry(
    store: LocalPackageStore,
    packageName: string,
    packagePath: string
  ): PackageEntry | null {
    return this.getPackagePathEntries(store, packageName)[packagePath] ?? null;
  }

  /**
   * Resolves the directory a package is published from.
   *
   * Throws when the package is not in the store, listing what is; when the
   * requested directory does not publish it; and when it is published from
   * several directories with none requested.
   *
   * @param store - The store to read
   * @param packageName - Name of the package to resolve the directory of
   * @param explicitPath - Directory the caller wants, which has to be one the package is published from
   */
  static getPackagePath(
    store: LocalPackageStore,
    packageName: string,
    explicitPath?: string
  ): string {
    const packagePaths = Object.keys(this.getPackagePathEntries(store, packageName));

    if (packagePaths.length === 0) {
      const availablePackages = Object.keys(store.packages);
      const available =
        availablePackages.length > 0 ? ` Available packages: ${availablePackages.join(', ')}` : '';
      throw new Error(`Package '${packageName}' not found in local registry.${available}`);
    }

    const candidates = packagePaths.map((packagePath) => `  ${packagePath}`).join('\n');

    if (explicitPath) {
      const requestedPath = path.resolve(explicitPath);
      if (!packagePaths.includes(requestedPath)) {
        throw new Error(
          `Package '${packageName}' is not published from ${requestedPath}. It is published from:\n${candidates}`
        );
      }
      return requestedPath;
    }

    if (packagePaths.length > 1) {
      throw new Error(
        `Package '${packageName}' is published from ${packagePaths.length} directories:\n${candidates}`
      );
    }

    return packagePaths[0];
  }

  /**
   * Gets every package a project is subscribed to, along with the directory
   * publishing it and the specifier to restore on unsubscribe.
   *
   * @param store - The store to read
   * @param subscriberPath - Path to the subscriber's project
   */
  static getSubscriptionsForSubscriber(
    store: LocalPackageStore,
    subscriberPath: string
  ): Array<{ packageName: string; packagePath: string; subscribersOriginalSpecifier: string }> {
    return Object.entries(store.packages).flatMap(([packageName, pathEntries]) =>
      Object.entries(pathEntries ?? {}).flatMap(([packagePath, entry]) => {
        const subscriber = entry?.subscribers.find(
          (candidate) => candidate.subscriberPath === subscriberPath
        );
        return subscriber
          ? [
              {
                packageName,
                packagePath,
                subscribersOriginalSpecifier: subscriber.originalSpecifier
              }
            ]
          : [];
      })
    );
  }

  /**
   * Writes the entry for a package published from a given directory.
   *
   * @param store - The store to update
   * @param packageName - Name of the package to update
   * @param packagePath - Resolved absolute path of the package
   * @param entry - Entry data to store for that path
   */
  static updatePackageEntry(
    store: LocalPackageStore,
    packageName: string,
    packagePath: string,
    entry: PackageEntry
  ): void {
    const pathEntries = store.packages[packageName] ?? {};
    pathEntries[packagePath] = entry;
    store.packages[packageName] = pathEntries;
  }

  /**
   * Removes one publishing directory from a package, dropping the package
   * itself along with its last directory.
   *
   * @param store - The store to update
   * @param packageName - Name of the package to remove the directory from
   * @param packagePath - Resolved absolute path of the package
   */
  static removePackagePath(
    store: LocalPackageStore,
    packageName: string,
    packagePath: string
  ): void {
    const pathEntries = store.packages[packageName];
    if (!pathEntries) {
      return;
    }
    delete pathEntries[packagePath];
    if (Object.keys(pathEntries).length === 0) {
      delete store.packages[packageName];
    }
  }

  /**
   * Removes a subscriber from the entry that holds it.
   *
   * @param store - The store to update
   * @param packageName - Name of the package to unsubscribe from
   * @param packagePath - Resolved absolute path of the package
   * @param subscriberPath - Path to the subscriber's project
   */
  static removeSubscriber(
    store: LocalPackageStore,
    packageName: string,
    packagePath: string,
    subscriberPath: string
  ): void {
    const entry = store.packages[packageName]?.[packagePath];
    if (!entry) {
      return;
    }
    entry.subscribers = entry.subscribers.filter(
      (subscriber) => subscriber.subscriberPath !== subscriberPath
    );
  }

  /**
   * Removes packages from the store that match a given pattern, returning the
   * names of the packages that were removed.
   *
   * @param store - The store to update
   * @param pattern - Regular expression pattern to match package names
   */
  static removePackagesByPattern(store: LocalPackageStore, pattern: RegExp): string[] {
    const matchedPackages: string[] = [];

    for (const packageName of Object.keys(store.packages)) {
      if (pattern.test(packageName)) {
        matchedPackages.push(packageName);
        delete store.packages[packageName];
      }
    }

    return matchedPackages;
  }

  /**
   * Clears all packages from the store.
   *
   * @param store - The store to update
   */
  static clearStore(store: LocalPackageStore): void {
    store.packages = {};
  }

  /**
   * Generates the version a package is published under, carrying the directory
   * it is published from and the moment it was published, and replacing any
   * suffix the original version already carries.
   *
   * The directory is hashed down to a fixed width slug because a version cannot
   * hold a whole path, which keeps two directories publishing the same package
   * from landing on the same version. The `p` prefix keeps that slug from being
   * read as a number.
   *
   * @param originalVersion - The original version string, which may already carry a suffix
   * @param packagePath - Resolved absolute path of the package being published
   */
  static generateTimestampVersion(originalVersion: string, packagePath: string): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.]/g, '')
      .slice(0, 17); // Include milliseconds (YYYYMMDDHHMMssSSS)
    const pathSlug = `p${createHash('sha256').update(packagePath).digest('hex').slice(0, 8)}`;
    const suffix = `-${pathSlug}.${timestamp}`;

    if (this.#TIMESTAMP_PATTERN.test(originalVersion)) {
      return originalVersion.replace(this.#TIMESTAMP_PATTERN, suffix);
    }

    return `${originalVersion}${suffix}`;
  }

  /**
   * Gets the store file path from configuration.
   */
  static async #getStoreFilePath(): Promise<string> {
    const storeDirectory = await ConfigService.getDataDirectoryPath();

    // Ensure the directory exists
    await fs.ensureDir(storeDirectory);

    return path.join(storeDirectory, LocalPackageStoreService.#STORE_FILE_NAME);
  }

  /**
   * Builds an empty store.
   */
  static #createEmptyStore(): LocalPackageStore {
    return { version: this.#STORE_VERSION, packages: {} };
  }

  /**
   * Checks whether a store declares the version this service writes, which
   * separates a store from an older version from a corrupt current one.
   *
   * @param rawStore - The parsed contents of the store file
   */
  static #storeDeclaresCorrectVersion(rawStore: unknown): boolean {
    return (
      typeof rawStore === 'object' &&
      rawStore !== null &&
      'version' in rawStore &&
      rawStore.version === this.#STORE_VERSION
    );
  }

  /**
   * Moves a store written under an older version out of the way, keeping the
   * subscriber paths and original specifiers it holds available for recovery by
   * hand.
   *
   * @param storeFilePath - Path of the store file to move
   */
  static async #deprecatePackageStore(storeFilePath: string): Promise<void> {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.]/g, '')
      .slice(0, 17);
    const deprecatedPath = `${storeFilePath}.deprecated-${timestamp}`;

    try {
      await fs.rename(storeFilePath, deprecatedPath);
    } catch (error) {
      throw new Error(
        `The local package store at ${storeFilePath} is not version ${this.#STORE_VERSION}, and it could not be deprecated to ${deprecatedPath}: ${String(error)}`,
        { cause: error }
      );
    }

    DR.logger.warn(
      `The local package store was deprecated to ${deprecatedPath} because it is not version ${this.#STORE_VERSION}. Subscribers have to subscribe again.`
    );
  }
}
