import { DR } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import path from 'path';
import { ConfigService } from './ConfigService.js';

/**
 * Defines the structure for a subscriber to a package.
 */
export type PackageSubscriber = {
  /** The absolute path to the project directory that subscribes to this package */
  subscriberPath: string;
  /** The original version specifier that existed for the package in the subscriber's dependencies */
  originalSpecifier: string;
};

/**
 * Defines the structure for a package entry in the local store.
 */
export type PackageEntry = {
  /** The original version from package.json before timestamp modifications */
  originalVersion: string;
  /** The current version with timestamp suffix */
  currentVersion: string;
  /** List of subscribers to this package */
  subscribers: PackageSubscriber[];
  /** The absolute path to the root directory of the package */
  packageRootPath: string;
  /** Additional arguments that were used when publishing this package */
  publishArgs?: string[];
};

/**
 * Defines the structure for the local package store.
 */
export type LocalPackageStore = {
  packages: {
    [packageName: string]: PackageEntry | undefined;
  };
};

export const timestampPattern = /-\d{17}$/;

const STORE_FILE_NAME = 'local-package-store.json';

/**
 * Service to manage the local package store.
 */
export class LocalPackageStoreService {
  /**
   * Reads the local package store from the file system.
   * If the store file does not exist, it returns an empty store.
   */
  static async getStore(): Promise<LocalPackageStore> {
    try {
      const storeFilePath = await this.getStoreFilePath();
      const fileExists = await fs.pathExists(storeFilePath);
      if (!fileExists) {
        return { packages: {} };
      }
      const store = (await fs.readJson(storeFilePath)) as LocalPackageStore;
      // Ensure the store has the correct structure for backwards compatibility
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (typeof store.packages !== 'object' || store.packages === null) {
        store.packages = {};
      }
      return store;
    } catch (error) {
      DR.logger.error(`Error reading local package store: ${String(error)}`);
      return { packages: {} }; // Return empty store on error
    }
  }

  /**
   * Updates a package entry in the store.
   *
   * @param packageName - Name of the package to update
   * @param entry - Package entry data to store
   */
  static async updatePackageEntry(packageName: string, entry: PackageEntry): Promise<void> {
    const store = await this.getStore();
    store.packages[packageName] = entry;
    await this.writeStore(store);
  }

  /**
   * Gets a package entry from the store.
   *
   * @param packageName - Name of the package to retrieve
   */
  static async getPackageEntry(packageName: string): Promise<PackageEntry | null> {
    const store = await this.getStore();
    return store.packages[packageName] ?? null;
  }

  /**
   * Removes a package from the store.
   *
   * @param packageName - Name of the package to remove
   */
  static async removePackage(packageName: string): Promise<void> {
    const store = await this.getStore();
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete store.packages[packageName];
    await this.writeStore(store);
  }

  /**
   * Adds a subscriber to a package.
   *
   * @param packageName - Name of the package to subscribe to
   * @param projectPath - Absolute path to the project directory
   * @param originalSpecifier - The original version specifier for this package
   */
  static async addSubscriber(
    packageName: string,
    projectPath: string,
    originalSpecifier: string
  ): Promise<void> {
    const store = await this.getStore();
    const entry = store.packages[packageName];
    if (entry && !entry.subscribers.some((sub) => sub.subscriberPath === projectPath)) {
      entry.subscribers.push({
        subscriberPath: projectPath,
        originalSpecifier
      });
      await this.writeStore(store);
    }
  }

  /**
   * Removes a subscriber from a package.
   *
   * @param packageName - Name of the package to unsubscribe from
   * @param projectPath - Absolute path to the project directory
   */
  static async removeSubscriber(packageName: string, projectPath: string): Promise<void> {
    const store = await this.getStore();
    const entry = store.packages[packageName];
    if (entry) {
      entry.subscribers = entry.subscribers.filter((sub) => sub.subscriberPath !== projectPath);
      await this.writeStore(store);
    }
  }

  /**
   * Gets all packages that a project is subscribed to.
   *
   * @param projectPath - Absolute path to the project directory
   */
  static async getSubscribedPackages(projectPath: string): Promise<string[]> {
    const store = await this.getStore();
    return Object.keys(store.packages).filter((packageName) =>
      store.packages[packageName]?.subscribers.some((sub) => sub.subscriberPath === projectPath)
    );
  }

  /**
   * Removes packages from the store that match a given pattern.
   *
   * @param pattern - Regular expression pattern to match package names
   */
  static async removePackagesByPattern(pattern: RegExp): Promise<string[]> {
    const store = await this.getStore();
    const packageNames = Object.keys(store.packages);
    const matchedPackages: string[] = [];

    for (const packageName of packageNames) {
      if (pattern.test(packageName)) {
        matchedPackages.push(packageName);
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete store.packages[packageName];
      }
    }

    if (matchedPackages.length > 0) {
      await this.writeStore(store);
    }

    return matchedPackages;
  }

  /**
   * Clears all packages from the store.
   */
  static async clearStore(): Promise<void> {
    const emptyStore: LocalPackageStore = { packages: {} };
    await this.writeStore(emptyStore);
  }

  /**
   * Gets the store file path from configuration.
   */
  private static async getStoreFilePath(): Promise<string> {
    const storeDirectory = await ConfigService.getDataDirectoryPath();

    // Ensure the directory exists
    await fs.ensureDir(storeDirectory);

    return path.join(storeDirectory, STORE_FILE_NAME);
  }

  /**
   * Writes the local package store to the file system.
   *
   * @param store - The store object to write.
   */
  private static async writeStore(store: LocalPackageStore): Promise<void> {
    try {
      const storeFilePath = await this.getStoreFilePath();
      await fs.writeJson(storeFilePath, store, { spaces: 2 });
    } catch (error) {
      DR.logger.error(`Error writing local package store: ${String(error)}`);
    }
  }
}
