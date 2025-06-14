import { DR } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { LocalPackageStoreService } from '../services/LocalPackageStoreService.js';
import { MutexService } from '../services/MutexService.js';
import { VerdaccioService } from '../services/VerdaccioService.js';
import { PackageManager } from '../types/PackageManager.js';
import { PublishCommand } from './PublishCommand.js';
import { SubscribeCommand } from './SubscribeCommand.js';
import { UnpublishCommand } from './UnpublishCommand.js';

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

  it('should unpublish package and reset subscribers with npm', async () => {
    await testUnpublishWithSubscribers(PackageManager.Npm, '3.0.0');
  });

  it('should unpublish package and reset subscribers with yarn', async () => {
    await testUnpublishWithSubscribers(PackageManager.Yarn, '3.1.0');
  });

  it('should unpublish package and reset subscribers with pnpm', async () => {
    await testUnpublishWithSubscribers(PackageManager.Pnpm, '3.2.0');
  });

  it('should unpublish package and reset subscribers with yarn4', async () => {
    await testUnpublishWithSubscribers(PackageManager.Yarn4, '3.3.0');
  });

  it('should unpublish specific package by name with npm', async () => {
    await testUnpublishByName(PackageManager.Npm, '4.0.0');
  });

  it('should unpublish specific package by name with yarn', async () => {
    await testUnpublishByName(PackageManager.Yarn, '4.1.0');
  });

  it('should unpublish specific package by name with pnpm', async () => {
    await testUnpublishByName(PackageManager.Pnpm, '4.2.0');
  });

  it('should unpublish specific package by name with yarn4', async () => {
    await testUnpublishByName(PackageManager.Yarn4, '4.3.0');
  });

  it('should handle unpublishing non-existent package', async () => {
    await expect(
      UnpublishCommand.execute(`@test-${testId}/non-existent`)
    ).rejects.toThrow(
      `Package '@test-${testId}/non-existent' not found in local registry`
    );
  });

  it('should handle unpublishing from directory without package.json', async () => {
    const emptyDir = path.join(
      TestProjectUtils.getTestInstanceDir(),
      'empty-unpublish'
    );
    await fs.ensureDir(emptyDir);
    TestProjectUtils.changeToProject(emptyDir);

    await expect(UnpublishCommand.execute()).rejects.toThrow(
      'No package.json found in current directory'
    );
  });

  /**
   * Helper function to test unpublishing from current directory with subscribers
   *
   * @param packageManager The package manager to test with
   * @param version The version to use for the test package
   */
  const testUnpublishWithSubscribers = async (
    packageManager: PackageManager,
    version: string
  ) => {
    // Create and setup publisher and subscriber
    const { publisherPath, subscriberPath, packageName } =
      await setupPublisherAndSubscriber(
        packageManager,
        version,
        'unpublish-current'
      );

    // Verify subscription is active before unpublishing
    let subscriberPackageJson =
      await TestProjectUtils.readPackageJson(subscriberPath);
    const timestampPattern = new RegExp(
      `^${version.replace(/\./g, '\\.')}-\\d{17}$`
    );
    expect(subscriberPackageJson.dependencies?.[packageName]).toMatch(
      timestampPattern
    );

    // Unpublish from publisher directory (current directory)
    TestProjectUtils.changeToProject(publisherPath);
    await UnpublishCommand.execute();

    // Verify package was removed from local store
    const packageEntry = await TestProjectUtils.getPackageEntry(packageName);
    expect(packageEntry).toBeNull();

    // Verify subscriber was reset to original version
    subscriberPackageJson =
      await TestProjectUtils.readPackageJson(subscriberPath);
    expect(subscriberPackageJson.dependencies?.[packageName]).toBe(version);

    // Verify publisher's package.json was reset to original version
    const publisherPackageJson =
      await TestProjectUtils.readPackageJson(publisherPath);
    expect(publisherPackageJson.version).toBe(version);

    // Verify success message was logged
    expect(DR.logger.info).toHaveBeenCalledWith(
      `Successfully unpublished ${packageName} and reset all subscribers`
    );
  };

  /**
   * Helper function to test unpublishing by package name
   *
   * @param packageManager The package manager to test with
   * @param version The version to use for the test package
   */
  const testUnpublishByName = async (
    packageManager: PackageManager,
    version: string
  ) => {
    // Create and setup publisher and subscriber
    const { publisherPath, subscriberPath, packageName } =
      await setupPublisherAndSubscriber(
        packageManager,
        version,
        'unpublish-by-name'
      );

    // Change to a different directory (not the publisher directory)
    const otherDir = path.join(
      TestProjectUtils.getTestInstanceDir(),
      'other-dir'
    );
    await fs.ensureDir(otherDir);
    TestProjectUtils.changeToProject(otherDir);

    // Unpublish by package name
    await UnpublishCommand.execute(packageName);

    // Verify package was removed from local store
    const packageEntry = await TestProjectUtils.getPackageEntry(packageName);
    expect(packageEntry).toBeNull();

    // Verify subscriber was reset to original version
    const subscriberPackageJson =
      await TestProjectUtils.readPackageJson(subscriberPath);
    expect(subscriberPackageJson.dependencies?.[packageName]).toBe(version);

    // Verify publisher's package.json was NOT modified (since we weren't in that directory)
    const publisherPackageJson =
      await TestProjectUtils.readPackageJson(publisherPath);
    expect(publisherPackageJson.version).toMatch(version);

    // Verify success message was logged
    expect(DR.logger.info).toHaveBeenCalledWith(
      `Successfully unpublished ${packageName} and reset all subscribers`
    );
  };

  /**
   * Helper function to setup a publisher and subscriber for testing
   *
   * @param packageManager The package manager to use
   * @param version The version for the packages
   * @param testSuffix Suffix to make package names unique
   */
  const setupPublisherAndSubscriber = async (
    packageManager: PackageManager,
    version: string,
    testSuffix: string
  ) => {
    const packageName = `@test-${testId}/${packageManager}-${testSuffix}`;

    // Create publisher package
    const publisherPath = await TestProjectUtils.createTestPackage(
      packageName,
      version,
      packageManager
    );

    // Create subscriber package
    const subscriberPath = await TestProjectUtils.createSubscriberProject(
      `@test-${testId}/${packageManager}-${testSuffix}-subscriber`,
      packageName,
      version,
      packageManager
    );

    // Publish the package
    TestProjectUtils.changeToProject(publisherPath);
    await PublishCommand.execute();

    // Subscribe to the package
    TestProjectUtils.changeToProject(subscriberPath);
    await SubscribeCommand.execute(packageName);

    return {
      publisherPath,
      subscriberPath,
      packageName
    };
  };
});
