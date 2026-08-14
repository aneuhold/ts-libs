import { randomUUID } from 'crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { VerdaccioService } from '../services/Verdaccio.service.js';
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
    const store = await LocalPackageStoreService.getStore();
    const packageEntry = LocalPackageStoreService.getPackageEntry(
      store,
      `@test-${testId}/subscribe-target`,
      publisherPath
    );
    expect(
      packageEntry?.subscribers.some(
        (s) => s.subscriberPath === subscriberPath && s.originalSpecifier === '^1.0.0'
      )
    ).toBe(true);
  });

  it('should not record a local version as what a subscriber is put back on', async () => {
    const packageName = `@test-${testId}/reset-target`;
    const { publisherPath, subscriberPath } = await TestProjectUtils.publishAndSubscribe(
      packageName,
      `${packageName}-subscriber`
    );

    // A reset that failed partway leaves the subscriber pinned to the local
    // version while the store no longer holds the subscription
    await TestProjectUtils.mutateStore((store) => {
      LocalPackageStoreService.removeSubscriber(store, packageName, publisherPath, subscriberPath);
    });

    TestProjectUtils.changeToProject(subscriberPath);
    await SubscribeCommand.execute(packageName);

    const packageEntry = LocalPackageStoreService.getPackageEntry(
      await LocalPackageStoreService.getStore(),
      packageName,
      publisherPath
    );
    const subscriber = packageEntry?.subscribers.find(
      (candidate) => candidate.subscriberPath === subscriberPath
    );
    expect(subscriber?.originalSpecifier).toBe('1.0.0');
  });

  it('should refuse to bind when the package is published from several directories', async () => {
    const packageName = `@test-${testId}/ambiguous-target`;
    const { firstPublisherPath, secondPublisherPath } =
      await TestProjectUtils.publishFromTwoDirectories(packageName);

    const subscriberPath = await TestProjectUtils.createSubscriberProject(
      `@test-${testId}/ambiguous-subscriber`,
      packageName,
      '^1.0.0'
    );
    TestProjectUtils.changeToProject(subscriberPath);

    // Which directory the subscriber wants cannot be inferred from it, so both
    // have to be reported rather than one of them guessed at
    await expect(SubscribeCommand.execute(packageName)).rejects.toThrow(firstPublisherPath);
    await expect(SubscribeCommand.execute(packageName)).rejects.toThrow(secondPublisherPath);
    await expect(SubscribeCommand.execute(packageName)).rejects.toThrow('--path');
  });

  it('should move a subscriber between publishing directories and keep its original specifier', async () => {
    const packageName = `@test-${testId}/move-target`;
    const { firstPublisherPath, secondPublisherPath } =
      await TestProjectUtils.publishFromTwoDirectories(packageName);

    const subscriberPath = await TestProjectUtils.createSubscriberProject(
      `@test-${testId}/move-subscriber`,
      packageName,
      '^1.0.0'
    );

    TestProjectUtils.changeToProject(subscriberPath);
    await SubscribeCommand.execute(packageName, firstPublisherPath);
    await SubscribeCommand.execute(packageName, secondPublisherPath);

    // A subscriber has one specifier slot per dependency, so the binding moves
    // rather than joins, and what it recorded before moving is what unsubscribe
    // restores
    const store = await LocalPackageStoreService.getStore();
    const firstPublisherEntry = LocalPackageStoreService.getPackageEntry(
      store,
      packageName,
      firstPublisherPath
    );
    const secondPublisherEntry = LocalPackageStoreService.getPackageEntry(
      store,
      packageName,
      secondPublisherPath
    );
    expect(
      firstPublisherEntry?.subscribers.some(
        (subscriber) => subscriber.subscriberPath === subscriberPath
      )
    ).toBe(false);
    expect(secondPublisherEntry?.subscribers).toContainEqual({
      subscriberPath,
      originalSpecifier: '^1.0.0'
    });
  });
});
