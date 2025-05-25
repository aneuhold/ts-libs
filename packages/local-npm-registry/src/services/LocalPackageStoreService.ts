import fs from 'fs-extra';
import path from 'path';

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
  private storeFilePath: string;

  /**
   * Initializes a new instance of the `LocalPackageStoreService` class.
   *
   * @param workspaceRoot - The root directory of the workspace.
   */
  constructor(private workspaceRoot: string) {
    this.storeFilePath = path.join(this.workspaceRoot, STORE_FILE_NAME);
  }

  /**
   * Reads the local package store from the file system.
   * If the store file does not exist, it returns an empty store.
   */
  public async getStore(): Promise<LocalPackageStore> {
    try {
      const fileExists = await fs.pathExists(this.storeFilePath);
      if (!fileExists) {
        return {};
      }
      const store = (await fs.readJson(
        this.storeFilePath
      )) as LocalPackageStore;
      return store;
    } catch (error) {
      console.error('Error reading local package store:', error);
      return {}; // Return empty store on error
    }
  }

  /**
   * Updates the version of a package in the store and writes it to the file system.
   *
   * @param packageName - The name of the package to update.
   * @param version - The new version of the package.
   */
  public async updatePackageVersion(
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
  private async writeStore(store: LocalPackageStore): Promise<void> {
    try {
      await fs.writeJson(this.storeFilePath, store, { spaces: 2 });
    } catch (error) {
      console.error('Error writing local package store:', error);
    }
  }
}
