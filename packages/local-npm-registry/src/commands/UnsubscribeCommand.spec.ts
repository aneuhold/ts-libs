import { DR } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { VerdaccioService } from '../services/Verdaccio.service.js';
import { PackageManager } from '../types/PackageManager.js';
import { PublishCommand } from './PublishCommand.js';
import { SubscribeCommand } from './SubscribeCommand.js';
import { UnsubscribeCommand } from './UnsubscribeCommand.js';

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

  it('should unsubscribe from specific package with npm', async () => {
    await testUnsubscribeFromSpecificPackage(PackageManager.Npm, '1.0.0');
  });

  it('should unsubscribe from specific package with yarn', async () => {
    await testUnsubscribeFromSpecificPackage(PackageManager.Yarn, '1.1.0');
  });

  it('should unsubscribe from specific package with pnpm', async () => {
    await testUnsubscribeFromSpecificPackage(PackageManager.Pnpm, '1.2.0');
  });

  it('should unsubscribe from specific package with yarn4', async () => {
    await testUnsubscribeFromSpecificPackage(PackageManager.Yarn4, '1.3.0');
  });

  it('should keep a project installable when it stays subscribed to another package', async () => {
    const droppedName = `@test-${testId}/dropped-lib`;
    const keptName = `@test-${testId}/kept-lib`;

    const droppedPath = await TestProjectUtils.createTestPackage(droppedName, '1.0.0');
    const keptPath = await TestProjectUtils.createTestPackage(keptName, '1.0.0');
    const subscriberPath = await TestProjectUtils.createTestPackage(
      `@test-${testId}/two-package-subscriber`,
      '1.0.0',
      PackageManager.Npm,
      { [droppedName]: '^1.0.0' }
    );

    // A plain 1.0.0 for the specifier the project is reset to, which outside a
    // test comes from the public registry
    await VerdaccioService.start();
    await VerdaccioService.publishPackage(droppedPath);
    await VerdaccioService.stop();

    for (const publisherPath of [droppedPath, keptPath]) {
      TestProjectUtils.changeToProject(publisherPath);
      await PublishCommand.execute();
    }

    TestProjectUtils.changeToProject(subscriberPath);
    await SubscribeCommand.execute(droppedName);
    await TestProjectUtils.addDependencyToProject(subscriberPath, keptName, '^1.0.0');
    await SubscribeCommand.execute(keptName);

    const store = await LocalPackageStoreService.getStore();
    const keptVersion = LocalPackageStoreService.getPackageEntry(
      store,
      keptName,
      keptPath
    )?.currentVersion;

    await UnsubscribeCommand.execute(droppedName);

    // The project is still pinned to a version only the local registry holds,
    // so the install has to have gone through it, and resolving the specifier
    // it was reset to at all is what says it did
    expect(
      (await TestProjectUtils.readInstalledPackageJson(subscriberPath, droppedName)).version
    ).toBe('1.0.0');
    expect(
      (await TestProjectUtils.readInstalledPackageJson(subscriberPath, keptName)).version
    ).toBe(keptVersion);
  });

  it('should handle unsubscribing from non-existent package', async () => {
    const subscriberPath = await TestProjectUtils.createSubscriberProject(
      `@test-${testId}/unsubscribe-test`,
      `@test-${testId}/non-existent`,
      '1.0.0'
    );

    TestProjectUtils.changeToProject(subscriberPath);

    await expect(UnsubscribeCommand.execute(`@test-${testId}/non-existent`)).rejects.toThrow(
      `Package '@test-${testId}/non-existent' not found in local registry`
    );
  });

  it('should handle unsubscribing when not subscribed', async () => {
    // Create and publish a package
    const publisherPath = await TestProjectUtils.createTestPackage(
      `@test-${testId}/unsubscribe-not-subscribed`,
      '1.0.0'
    );
    TestProjectUtils.changeToProject(publisherPath);
    await PublishCommand.execute();

    // Create a subscriber but don't actually subscribe
    const subscriberPath = await TestProjectUtils.createSubscriberProject(
      `@test-${testId}/unsubscribe-subscriber`,
      `@test-${testId}/unsubscribe-not-subscribed`,
      '1.0.0'
    );

    TestProjectUtils.changeToProject(subscriberPath);

    await expect(
      UnsubscribeCommand.execute(`@test-${testId}/unsubscribe-not-subscribed`)
    ).rejects.toThrow();
  });

  /**
   * Helper function to test unsubscribing from a specific package
   *
   * @param packageManager The package manager to test with
   * @param version The version to use for the test package
   */
  const testUnsubscribeFromSpecificPackage = async (
    packageManager: PackageManager,
    version: string
  ) => {
    // Create and setup publisher and subscriber
    const packageName = `@test-${testId}/${packageManager}-unsubscribe-specific`;
    const { publisherPath, subscriberPath } = await TestProjectUtils.publishAndSubscribe(
      packageName,
      `${packageName}-subscriber`,
      packageManager,
      version
    );

    // Verify subscription is active (package has timestamp version)
    let subscriberPackageJson = await TestProjectUtils.readPackageJson(subscriberPath);
    expect(subscriberPackageJson.dependencies?.[packageName]).toMatch(
      TestProjectUtils.getLocalVersionPattern(version, publisherPath)
    );

    // Unsubscribe from the package
    TestProjectUtils.changeToProject(subscriberPath);
    await UnsubscribeCommand.execute(packageName);

    // Verify package entry no longer has this subscriber
    const store = await LocalPackageStoreService.getStore();
    const packageEntry = LocalPackageStoreService.getPackageEntry(
      store,
      packageName,
      publisherPath
    );
    expect(packageEntry?.subscribers.some((s) => s.subscriberPath === subscriberPath)).toBe(false);

    // Verify subscriber's package.json was reset to original version
    subscriberPackageJson = await TestProjectUtils.readPackageJson(subscriberPath);
    expect(subscriberPackageJson.dependencies?.[packageName]).toBe(version);

    // Verify success message was logged
    expect(DR.logger.info).toHaveBeenCalledWith(`Successfully unsubscribed from ${packageName}`);
  };
});
