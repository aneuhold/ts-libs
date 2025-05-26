import { DR } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import path from 'path';
import { ConfigService } from './ConfigService.js';

/**
 * Defines the structure for the local package store.
 */
export type LocalPackageStore = {
  [packageName: string]: string; // package name -> version
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
        return {};
      }
      const store = (await fs.readJson(storeFilePath)) as LocalPackageStore;
      return store;
    } catch (error) {
      DR.logger.error(`Error reading local package store: ${String(error)}`);
      return {}; // Return empty store on error
    }
  }

  /**
   * Updates the version of a package in the store and writes it to the file system.
   *
   * @param packageName - The name of the package to update.
   * @param version - The new version of the package.
   */
  static async updatePackageVersion(
    packageName: string,
    version: string
  ): Promise<void> {
    const store = await this.getStore();
    store[packageName] = version;
    await this.writeStore(store);
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
