import { DR } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import path from 'path';
import { ConfigService } from './ConfigService.js';

/**
 * Defines the structure for a package entry in the local store.
 */
export type PackageEntry = {
  /** The original version from package.json before timestamp modifications */
  originalVersion: string;
  /** The current version with timestamp suffix */
  currentVersion: string;
  /** List of absolute paths to projects that subscribe to this package */
  subscribers: string[];
  /** The absolute path to the root directory of the package */
  packageRootPath: string;
};

/**
 * Defines the structure for the local package store.
 */
export type LocalPackageStore = {
  packages: {
    [packageName: string]: PackageEntry | undefined;
  };
};

const STORE_FILE_NAME = '.local-package-store.json';

/**
 * Service to manage the local package store.
 */
export class LocalPackageStoreService {
  /**
   * Gets the store file path from configuration.
   */
  private static async getStoreFilePath(): Promise<string> {
    const config = await ConfigService.loadConfig();
    return path.join(config.storeLocation || process.cwd(), STORE_FILE_NAME);
  }

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
  static async updatePackageEntry(
    packageName: string,
    entry: PackageEntry
  ): Promise<void> {
    const store = await this.getStore();
    store.packages[packageName] = entry;
    await this.writeStore(store);
  }

  /**
   * Gets a package entry from the store.
   *
   * @param packageName - Name of the package to retrieve
   */
  static async getPackageEntry(
    packageName: string
  ): Promise<PackageEntry | null> {
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
   */
  static async addSubscriber(
    packageName: string,
    projectPath: string
  ): Promise<void> {
    const store = await this.getStore();
    const entry = store.packages[packageName];
    if (entry && !entry.subscribers.includes(projectPath)) {
      entry.subscribers.push(projectPath);
      await this.writeStore(store);
    }
  }

  /**
   * Removes a subscriber from a package.
   *
   * @param packageName - Name of the package to unsubscribe from
   * @param projectPath - Absolute path to the project directory
   */
  static async removeSubscriber(
    packageName: string,
    projectPath: string
  ): Promise<void> {
    const store = await this.getStore();
    const entry = store.packages[packageName];
    if (entry) {
      entry.subscribers = entry.subscribers.filter(
        (sub) => sub !== projectPath
      );
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
      store.packages[packageName]?.subscribers.includes(projectPath)
    );
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

  /**
   * Clears all packages from the store.
   */
  static async clearStore(): Promise<void> {
    const emptyStore: LocalPackageStore = { packages: {} };
    await this.writeStore(emptyStore);
  }
}
