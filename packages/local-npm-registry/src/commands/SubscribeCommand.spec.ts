import { randomUUID } from 'crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { LocalPackageStoreService } from '../services/LocalPackageStoreService.js';
import { MutexService } from '../services/MutexService.js';
import { VerdaccioService } from '../services/VerdaccioService.js';
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

  it('should add current directory as subscriber to a package', async () => {
    // Create publisher package
    const publisherPath = await TestProjectUtils.createTestPackage(
      `@test-${testId}/subscribe-target`,
      '1.0.0'
    );

    // Create and publish the target package first
    TestProjectUtils.changeToProject(publisherPath);
    await PublishCommand.execute();

    // Create subscriber package
    const subscriberPath = await TestProjectUtils.createSubscriberProject(
      `@test-${testId}/new-subscriber`,
      `@test-${testId}/subscribe-target`,
      '^1.0.0'
    );

    // Subscribe from subscriber directory
    TestProjectUtils.changeToProject(subscriberPath);
    await SubscribeCommand.execute(`@test-${testId}/subscribe-target`);

    // Verify subscriber was added
    const packageEntry = await TestProjectUtils.getPackageEntry(`@test-${testId}/subscribe-target`);
    expect(
      packageEntry?.subscribers.some(
        (s) => s.subscriberPath === subscriberPath && s.originalSpecifier === '^1.0.0'
      )
    ).toBe(true);
  });
});
