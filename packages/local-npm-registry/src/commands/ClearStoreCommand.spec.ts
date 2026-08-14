import { DR } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { VerdaccioService } from '../services/Verdaccio.service.js';
import { PackageManager } from '../types/PackageManager.js';
import { ClearStoreCommand } from './ClearStoreCommand.js';
import { PublishCommand } from './PublishCommand.js';
import { SubscribeCommand } from './SubscribeCommand.js';

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
    vi.clearAllMocks();
    await TestProjectUtils.setupTestInstance();
    testId = randomUUID().slice(0, 8);
    TestProjectUtils.stubInstallWithoutRegistry();
    // Ensure clean mutex state for each test
    try {
      await MutexService.forceReleaseLock();
    } catch {
      // Ignore errors if no lock exists or server wasn't running
    }
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await TestProjectUtils.cleanupTestInstance();
    // Clean up mutex lock after each test
    try {
      await MutexService.forceReleaseLock();
      await VerdaccioService.stop();
    } catch {
      // Ignore errors during cleanup
    }
  });

  it('should clear all package entries from the local store', async () => {
    // Create and publish multiple test packages
    const package1Path = await TestProjectUtils.createTestPackage(
      `@test-${testId}/clear-test-1`,
      '1.0.0'
    );
    const package2Path = await TestProjectUtils.createTestPackage(
      `@test-${testId}/clear-test-2`,
      '2.0.0'
    );

    // Publish both packages
    TestProjectUtils.changeToProject(package1Path);
    await PublishCommand.execute();

    TestProjectUtils.changeToProject(package2Path);
    await PublishCommand.execute();

    // Verify packages exist in store
    let store = await LocalPackageStoreService.getStore();
    let package1Entry = LocalPackageStoreService.getPackageEntry(
      store,
      `@test-${testId}/clear-test-1`,
      package1Path
    );
    let package2Entry = LocalPackageStoreService.getPackageEntry(
      store,
      `@test-${testId}/clear-test-2`,
      package2Path
    );
    expect(package1Entry).toBeTruthy();
    expect(package2Entry).toBeTruthy();

    // Clear the store
    await ClearStoreCommand.execute();

    // Verify packages are removed from store
    store = await LocalPackageStoreService.getStore();
    package1Entry = LocalPackageStoreService.getPackageEntry(
      store,
      `@test-${testId}/clear-test-1`,
      package1Path
    );
    package2Entry = LocalPackageStoreService.getPackageEntry(
      store,
      `@test-${testId}/clear-test-2`,
      package2Path
    );
    expect(package1Entry).toBeNull();
    expect(package2Entry).toBeNull();

    // Verify success message was logged
    expect(DR.logger.info).toHaveBeenCalledWith('Successfully cleared all 2 package(s)');
  });

  it('should install once in a subscriber of two packages', async () => {
    const firstName = `@test-${testId}/first-lib`;
    const secondName = `@test-${testId}/second-lib`;

    const firstPath = await TestProjectUtils.createTestPackage(firstName, '1.0.0');
    const secondPath = await TestProjectUtils.createTestPackage(secondName, '1.0.0');
    const subscriberPath = await TestProjectUtils.createTestPackage(
      `@test-${testId}/two-package-subscriber`,
      '1.0.0',
      PackageManager.Npm,
      { [firstName]: '^1.0.0' }
    );

    for (const publisherPath of [firstPath, secondPath]) {
      TestProjectUtils.changeToProject(publisherPath);
      await PublishCommand.execute();
    }

    // The second dependency can only be declared once the first one resolves,
    // since a range never matches the prerelease a local publish produces
    TestProjectUtils.changeToProject(subscriberPath);
    await SubscribeCommand.execute(firstName);
    await TestProjectUtils.addDependencyToProject(subscriberPath, secondName, '^1.0.0');
    await SubscribeCommand.execute(secondName);

    const runInstall = TestProjectUtils.stubInstallWithoutRegistry();

    await ClearStoreCommand.execute();

    const installsInSubscriber = runInstall.mock.calls.filter(
      ([projectPath]) => projectPath === subscriberPath
    );
    expect(installsInSubscriber).toHaveLength(1);

    const subscriberPackageJson = await TestProjectUtils.readPackageJson(subscriberPath);
    expect(subscriberPackageJson.dependencies?.[firstName]).toBe('^1.0.0');
    expect(subscriberPackageJson.dependencies?.[secondName]).toBe('^1.0.0');
  });

  it('should handle clearing an empty store gracefully', async () => {
    // Clear the store when it's already empty
    await ClearStoreCommand.execute();

    // Verify success message was still logged
    expect(DR.logger.info).toHaveBeenCalledWith('No packages in local registry to clear');
  });
});
