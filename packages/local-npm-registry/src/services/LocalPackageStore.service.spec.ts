import { DR } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConcurrentTestProjectUtils } from '../../test-utils/ConcurrentTestProjectUtils.js';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { ConfigService } from './Config.service.js';
import { LocalPackageStoreService } from './LocalPackageStore.service.js';

vi.mock('@aneuhold/core-ts-lib', async () => {
  const actual = await vi.importActual('@aneuhold/core-ts-lib');
  return {
    ...actual,
    DR: {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
        setVerboseLogging: vi.fn(),
        isVerboseLoggingEnabled: vi.fn(() => false)
      }
    }
  };
});

const STORE_FILE_NAME = 'local-package-store.json';
const DEPRECATED_PREFIX = `${STORE_FILE_NAME}.deprecated-`;

describe('Integration Tests', () => {
  let testId: string;

  beforeAll(async () => {
    await TestProjectUtils.setupGlobalTempDir();
  });

  afterAll(async () => {
    await TestProjectUtils.cleanupGlobalTempDir();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestProjectUtils.setupTestInstance();
    testId = randomUUID().slice(0, 8);
    await removeStoreFiles();
  });

  afterEach(async () => {
    await removeStoreFiles();
    await TestProjectUtils.cleanupTestInstance();
  });

  describe('getStore', () => {
    it('should deprecate a store written under an older version', async () => {
      const storeFilePath = await getStoreFilePath();
      await fs.writeJson(storeFilePath, {
        packages: {
          '@test/library': {
            originalVersion: '1.0.0',
            currentVersion: '1.0.0-20250726123456789',
            subscribers: [{ subscriberPath: '/dev/consumer', originalSpecifier: '^1.0.0' }],
            packageRootPath: '/dev/library'
          }
        }
      });

      const store = await LocalPackageStoreService.getStore();

      expect(store).toEqual({ version: 2, packages: {} });
      await expectStoreWasDeprecated(storeFilePath);
    });

    it('should throw rather than discard a store that cannot be parsed', async () => {
      const storeFilePath = await getStoreFilePath();
      await fs.writeFile(storeFilePath, '{ "version": 2, "packages":');

      await expect(LocalPackageStoreService.getStore()).rejects.toThrow();
      expect(await fs.pathExists(storeFilePath)).toBe(true);
    });

    it('should throw rather than discard a store holding a malformed entry', async () => {
      const storeFilePath = await getStoreFilePath();
      await fs.writeJson(storeFilePath, {
        version: 2,
        packages: {
          '@test/library': {
            '/dev/library': {
              originalVersion: '1.0.0',
              currentVersion: '1.0.0-20250726123456789',
              subscribers: [{ subscriberPath: '/dev/consumer' }]
            }
          }
        }
      });

      await expect(LocalPackageStoreService.getStore()).rejects.toThrow(
        'declares version 2 but does not hold a valid store'
      );
      expect(await fs.pathExists(storeFilePath)).toBe(true);
    });

    it('should read a valid store back', async () => {
      const packagePath = TestProjectUtils.getTestInstanceDir();
      const writtenStore = await LocalPackageStoreService.getStore();
      LocalPackageStoreService.updatePackageEntry(
        writtenStore,
        `@test-${testId}/library`,
        packagePath,
        {
          originalVersion: '1.0.0',
          currentVersion: '1.0.0-20250726123456789',
          subscribers: []
        }
      );
      await LocalPackageStoreService.writeStore(writtenStore);

      const store = await LocalPackageStoreService.getStore();

      expect(store.version).toBe(2);
      expect(Object.keys(store.packages[`@test-${testId}/library`] ?? {})).toEqual([packagePath]);
      expect(DR.logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('writeStore', () => {
    it('should lose no updates when several processes write at once', async () => {
      const workerCount = 4;

      await ConcurrentTestProjectUtils.runConcurrently('writeStoreEntry.ts', workerCount, [
        TestProjectUtils.getTestInstanceDir()
      ]);

      const store = await LocalPackageStoreService.getStore();

      expect(Object.keys(store.packages)).toHaveLength(workerCount);
    }, 30000);
  });

  describe('getSubscriptions', () => {
    it('should find a binding regardless of which directory published it', async () => {
      const packageName = `@test-${testId}/library`;
      const subscriberPath = path.join(TestProjectUtils.getTestInstanceDir(), 'consumer');
      const firstPath = path.join(TestProjectUtils.getTestInstanceDir(), 'first-publisher');
      const secondPath = path.join(TestProjectUtils.getTestInstanceDir(), 'second-publisher');

      const store = await LocalPackageStoreService.getStore();
      LocalPackageStoreService.updatePackageEntry(store, packageName, firstPath, {
        originalVersion: '1.0.0',
        currentVersion: '1.0.0',
        subscribers: []
      });
      LocalPackageStoreService.updatePackageEntry(store, packageName, secondPath, {
        originalVersion: '2.0.0',
        currentVersion: '2.0.0',
        subscribers: [{ subscriberPath, originalSpecifier: '^2.0.0' }]
      });

      const subscriptions = LocalPackageStoreService.getSubscriptionsForSubscriber(
        store,
        subscriberPath
      );

      expect(subscriptions).toEqual([
        { packageName, packagePath: secondPath, subscriberPath, originalSpecifier: '^2.0.0' }
      ]);
    });
  });

  describe('removePackagePath', () => {
    it('should drop the package along with its last publishing directory', async () => {
      const packageName = `@test-${testId}/library`;
      const firstPath = path.join(TestProjectUtils.getTestInstanceDir(), 'first-publisher');
      const secondPath = path.join(TestProjectUtils.getTestInstanceDir(), 'second-publisher');

      const store = await LocalPackageStoreService.getStore();
      for (const packagePath of [firstPath, secondPath]) {
        LocalPackageStoreService.updatePackageEntry(store, packageName, packagePath, {
          originalVersion: '1.0.0',
          currentVersion: '1.0.0',
          subscribers: []
        });
      }

      LocalPackageStoreService.removePackagePath(store, packageName, firstPath);
      expect(
        Object.keys(LocalPackageStoreService.getPackagePathEntries(store, packageName))
      ).toEqual([secondPath]);

      LocalPackageStoreService.removePackagePath(store, packageName, secondPath);
      expect(packageName in store.packages).toBe(false);
    });
  });

  /**
   * Builds the path of the store file the configured data directory holds
   */
  const getStoreFilePath = async (): Promise<string> => {
    const dataDirectory = await ConfigService.getDataDirectoryPath();
    await fs.ensureDir(dataDirectory);
    return path.join(dataDirectory, STORE_FILE_NAME);
  };

  /**
   * Removes the store and anything set aside from it, so each test starts from
   * a directory with no store in it
   */
  const removeStoreFiles = async (): Promise<void> => {
    const dataDirectory = await ConfigService.getDataDirectoryPath();
    if (!(await fs.pathExists(dataDirectory))) {
      return;
    }
    const fileNames = await fs.readdir(dataDirectory);

    for (const fileName of fileNames) {
      if (fileName.startsWith(STORE_FILE_NAME)) {
        await fs.remove(path.join(dataDirectory, fileName));
      }
    }
  };

  /**
   * Asserts that the store was moved out of the way and reported
   *
   * @param storeFilePath The path the store was read from
   */
  const expectStoreWasDeprecated = async (storeFilePath: string): Promise<void> => {
    expect(await fs.pathExists(storeFilePath)).toBe(false);

    const fileNames = await fs.readdir(path.dirname(storeFilePath));
    const deprecatedFileNames = fileNames.filter((fileName) =>
      fileName.startsWith(DEPRECATED_PREFIX)
    );

    expect(deprecatedFileNames).toHaveLength(1);
    expect(DR.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`${storeFilePath}.deprecated-`)
    );
  };
});
