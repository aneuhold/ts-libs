import { DR } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { LocalPackageStoreService } from '../services/LocalPackageStoreService.js';
import { MutexService } from '../services/MutexService.js';
import { VerdaccioService } from '../services/VerdaccioService.js';
import { ClearStoreCommand } from './ClearStoreCommand.js';
import { PublishCommand } from './PublishCommand.js';

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
    await LocalPackageStoreService.removePackagesByPattern(testPackagePattern);
  });

  // Per-test setup/teardown for unique test instances
  beforeEach(async () => {
    vi.clearAllMocks();
    await TestProjectUtils.setupTestInstance();
    testId = randomUUID().slice(0, 8);
    // Ensure clean mutex state for each test
    try {
      await MutexService.forceReleaseLock();
    } catch {
      // Ignore errors if no lock exists or server wasn't running
    }
  });

  afterEach(async () => {
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
    let package1Entry = await TestProjectUtils.getPackageEntry(`@test-${testId}/clear-test-1`);
    let package2Entry = await TestProjectUtils.getPackageEntry(`@test-${testId}/clear-test-2`);
    expect(package1Entry).toBeTruthy();
    expect(package2Entry).toBeTruthy();

    // Clear the store
    await ClearStoreCommand.execute();

    // Verify packages are removed from store
    package1Entry = await TestProjectUtils.getPackageEntry(`@test-${testId}/clear-test-1`);
    package2Entry = await TestProjectUtils.getPackageEntry(`@test-${testId}/clear-test-2`);
    expect(package1Entry).toBeNull();
    expect(package2Entry).toBeNull();

    // Verify success message was logged
    expect(DR.logger.info).toHaveBeenCalledWith('Successfully cleared all 2 package(s)');
  });

  it('should handle clearing an empty store gracefully', async () => {
    // Clear the store when it's already empty
    await ClearStoreCommand.execute();

    // Verify success message was still logged
    expect(DR.logger.info).toHaveBeenCalledWith('No packages in local registry to clear');
  });
});
