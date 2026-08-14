import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { LocalPackageStoreService } from './LocalPackageStore.service.js';
import { LocalPackageVersionService } from './LocalPackageVersion.service.js';
import { VerdaccioService } from './Verdaccio.service.js';

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

describe('Integration Tests', () => {
  let testId: string;

  // Global setup/teardown for the tmp directory
  beforeAll(async () => {
    await TestProjectUtils.setupGlobalTempDir();
  });

  afterAll(async () => {
    await TestProjectUtils.cleanupGlobalTempDir();
    const testPackagePattern = /^@test-[a-fA-F0-9]{8}\//;
    await TestProjectUtils.mutateStore((store) =>
      LocalPackageStoreService.removePackagesByPattern(store, testPackagePattern)
    );
  });

  // Per-test setup/teardown for unique test instances
  beforeEach(async () => {
    await TestProjectUtils.setupTestInstance();
    testId = randomUUID().slice(0, 8);
    await VerdaccioService.stop();
  });

  afterEach(async () => {
    try {
      await VerdaccioService.stop();
    } catch {
      // Ignore errors during cleanup
    }
    await TestProjectUtils.cleanupTestInstance();
  });

  describe('start', () => {
    it('should leave the server running when called again', async () => {
      await VerdaccioService.start();

      await expect(VerdaccioService.start()).resolves.not.toThrow();

      // The second call returning early rather than starting a second server is
      // what leaves this one able to stop it
      await expect(VerdaccioService.stop()).resolves.not.toThrow();
    });
  });

  describe('removeVersionsPublishedFrom', () => {
    it('should keep the version it is told to and leave another directory alone', async () => {
      const packageName = `@test-${testId}/registry-sweep`;
      const { firstPublisherPath, secondPublisherPath } =
        await TestProjectUtils.publishFromTwoDirectories(packageName);
      const keptVersion = await TestProjectUtils.getCurrentVersion(packageName, firstPublisherPath);
      const otherDirectoryVersion = await TestProjectUtils.getCurrentVersion(
        packageName,
        secondPublisherPath
      );

      // A publish killed before it writes the store leaves a version nothing
      // names, which is what the sweep is by slug rather than by store for
      const droppedTarball = TestProjectUtils.getRegistryTarballName(
        packageName,
        `1.0.0-${LocalPackageVersionService.getPathSlug(firstPublisherPath)}.00000000000000000`
      );
      const packageStorage = TestProjectUtils.getRegistryPackageStorage(packageName);
      await fs.writeFile(path.join(packageStorage, droppedTarball), '');

      // The server does not have to be running for a sweep, and is not here
      await VerdaccioService.removeVersionsPublishedFrom(
        packageName,
        firstPublisherPath,
        keptVersion
      );

      const tarballs = await fs.readdir(packageStorage);
      expect(tarballs).toContain(TestProjectUtils.getRegistryTarballName(packageName, keptVersion));
      expect(tarballs).not.toContain(droppedTarball);
      expect(tarballs).toContain(
        TestProjectUtils.getRegistryTarballName(packageName, otherDirectoryVersion)
      );
    });

    it('should drop the package once the last tarball of it goes', async () => {
      const packageName = `@test-${testId}/registry-drain`;
      const { firstPublisherPath, secondPublisherPath } =
        await TestProjectUtils.publishFromTwoDirectories(packageName);
      const packageStorage = TestProjectUtils.getRegistryPackageStorage(packageName);

      await VerdaccioService.removeVersionsPublishedFrom(packageName, firstPublisherPath);

      // The other directory still has a tarball, so what the registry serves it
      // from has to survive
      expect(await fs.pathExists(packageStorage)).toBe(true);
      expect(await TestProjectUtils.getRegistryDbPackageNames()).toContain(packageName);

      await VerdaccioService.removeVersionsPublishedFrom(packageName, secondPublisherPath);

      // Otherwise the directory survives as a metadata document naming versions
      // that have nothing behind them
      expect(await fs.pathExists(packageStorage)).toBe(false);
      expect(await TestProjectUtils.getRegistryDbPackageNames()).not.toContain(packageName);
    });

    it('should do nothing for a package the registry never held', async () => {
      const packageName = `@test-${testId}/never-published`;

      await expect(
        VerdaccioService.removeVersionsPublishedFrom(packageName, '/dev/nowhere')
      ).resolves.not.toThrow();

      expect(await fs.pathExists(TestProjectUtils.getRegistryPackageStorage(packageName))).toBe(
        false
      );
    });
  });

  describe('clearStorage', () => {
    it('should leave the registry holding nothing', async () => {
      await TestProjectUtils.publishFromTwoDirectories(`@test-${testId}/storage-clear`);
      const { storage } = VerdaccioService.verdaccioConfig;

      await VerdaccioService.clearStorage();

      expect(await fs.pathExists(storage)).toBe(false);
    });
  });
});
