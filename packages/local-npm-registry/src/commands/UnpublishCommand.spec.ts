import { DR } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { VerdaccioService } from '../services/Verdaccio.service.js';
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

  it('should keep a subscriber installable when it stays subscribed to another package', async () => {
    const unpublishedName = `@test-${testId}/unpublished-lib`;
    const keptName = `@test-${testId}/kept-lib`;

    const unpublishedPath = await TestProjectUtils.createTestPackage(unpublishedName, '1.0.0');
    const keptPath = await TestProjectUtils.createTestPackage(keptName, '1.0.0');
    const subscriberPath = await TestProjectUtils.createTestPackage(
      `@test-${testId}/two-package-subscriber`,
      '1.0.0',
      PackageManager.Npm,
      { [unpublishedName]: '^1.0.0' }
    );

    // A plain 1.0.0 for the specifier the subscriber is reset to. Outside a test
    // that comes from the public registry, which a package invented for a test
    // never reaches
    await VerdaccioService.start();
    await VerdaccioService.publishPackage(unpublishedPath);
    await VerdaccioService.stop();

    for (const publisherPath of [unpublishedPath, keptPath]) {
      TestProjectUtils.changeToProject(publisherPath);
      await PublishCommand.execute();
    }

    // The second dependency can only be declared once the first one resolves,
    // since a range never matches the prerelease a local publish produces
    TestProjectUtils.changeToProject(subscriberPath);
    await SubscribeCommand.execute(unpublishedName);
    await TestProjectUtils.addDependencyToProject(subscriberPath, keptName, '^1.0.0');
    await SubscribeCommand.execute(keptName);

    const keptVersion = await TestProjectUtils.getCurrentVersion(keptName, keptPath);

    await UnpublishCommand.execute(unpublishedName);

    const subscriberPackageJson = await TestProjectUtils.readPackageJson(subscriberPath);
    expect(subscriberPackageJson.dependencies?.[unpublishedName]).toBe('^1.0.0');
    expect(subscriberPackageJson.dependencies?.[keptName]).toBe(keptVersion);

    // The subscriber is still pinned to a version of the other package that only
    // the local registry holds, so the install has to have gone through it, and
    // resolving the reset specifier at all is what says it did
    const installedUnpublishedPackage = await TestProjectUtils.readInstalledPackageJson(
      subscriberPath,
      unpublishedName
    );
    expect(installedUnpublishedPackage.version).toBe('1.0.0');

    const installedKeptPackage = await TestProjectUtils.readInstalledPackageJson(
      subscriberPath,
      keptName
    );
    expect(installedKeptPackage.version).toBe(keptVersion);
  });

  it('should unpublish one publishing directory and leave the other resolvable', async () => {
    const packageName = `@test-${testId}/multi-path-target`;
    const { firstPublisherPath, secondPublisherPath } =
      await TestProjectUtils.publishFromTwoDirectories(packageName);

    const subscriberPath = await TestProjectUtils.createSubscriberProject(
      `@test-${testId}/multi-path-subscriber`,
      packageName,
      '^1.0.0'
    );
    TestProjectUtils.changeToProject(subscriberPath);
    await SubscribeCommand.execute(packageName, secondPublisherPath);

    const secondPublisherVersion = await TestProjectUtils.getCurrentVersion(
      packageName,
      secondPublisherPath
    );

    await UnpublishCommand.execute(packageName, firstPublisherPath);

    const store = await LocalPackageStoreService.getStore();
    expect(
      LocalPackageStoreService.getPackageEntry(store, packageName, firstPublisherPath)
    ).toBeNull();
    expect(
      LocalPackageStoreService.getPackageEntry(store, packageName, secondPublisherPath)
    ).toBeTruthy();

    // The subscriber bound to the other directory is untouched, and what it is
    // pinned to still installs
    expect(
      (await TestProjectUtils.readPackageJson(subscriberPath)).dependencies?.[packageName]
    ).toBe(secondPublisherVersion);
    expect(
      (await TestProjectUtils.readInstalledPackageJson(subscriberPath, packageName)).version
    ).toBe(secondPublisherVersion);
  });

  it('should unpublish every publishing directory with allPaths', async () => {
    const packageName = `@test-${testId}/all-paths-target`;
    const { firstPublisherPath, secondPublisherPath } =
      await TestProjectUtils.publishFromTwoDirectories(packageName);

    await UnpublishCommand.execute(packageName, undefined, true);

    const store = await LocalPackageStoreService.getStore();
    expect(LocalPackageStoreService.getPackagePathEntries(store, packageName)).toEqual({});
    expect(
      LocalPackageStoreService.getPackageEntry(store, packageName, firstPublisherPath)
    ).toBeNull();
    expect(
      LocalPackageStoreService.getPackageEntry(store, packageName, secondPublisherPath)
    ).toBeNull();
  });

  it('should leave nothing in the registry once no directory publishes the package', async () => {
    const packageName = `@test-${testId}/registry-cleanup`;
    const { firstPublisherPath } = await TestProjectUtils.publishFromTwoDirectories(packageName);
    const packageStorage = TestProjectUtils.getRegistryPackageStorage(packageName);

    // The directory that is left publishing still has a version in the registry
    await UnpublishCommand.execute(packageName, firstPublisherPath);

    expect(await fs.pathExists(packageStorage)).toBe(true);
    expect(await TestProjectUtils.getRegistryDbPackageNames()).toContain(packageName);

    await UnpublishCommand.execute(packageName, undefined, true);

    expect(await fs.pathExists(packageStorage)).toBe(false);
    expect(await TestProjectUtils.getRegistryDbPackageNames()).not.toContain(packageName);
  });

  it('should list the candidates when neither a path nor the current directory picks one', async () => {
    const packageName = `@test-${testId}/ambiguous-unpublish`;
    const { firstPublisherPath, secondPublisherPath } =
      await TestProjectUtils.publishFromTwoDirectories(packageName);

    const otherDir = path.join(TestProjectUtils.getTestInstanceDir(), 'not-a-publisher');
    await fs.ensureDir(otherDir);
    TestProjectUtils.changeToProject(otherDir);

    await expect(UnpublishCommand.execute(packageName)).rejects.toThrow(firstPublisherPath);
    await expect(UnpublishCommand.execute(packageName)).rejects.toThrow(secondPublisherPath);
  });

  it('should handle unpublishing non-existent package', async () => {
    await expect(UnpublishCommand.execute(`@test-${testId}/non-existent`)).rejects.toThrow(
      `No entries for package '@test-${testId}/non-existent' found in local registry`
    );
  });

  it('should handle unpublishing from directory without package.json', async () => {
    const emptyDir = path.join(TestProjectUtils.getTestInstanceDir(), 'empty-unpublish');
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
  const testUnpublishWithSubscribers = async (packageManager: PackageManager, version: string) => {
    // Create and setup publisher and subscriber
    const packageName = `@test-${testId}/${packageManager}-unpublish-current`;
    const { publisherPath, subscriberPath } = await TestProjectUtils.publishAndSubscribe(
      packageName,
      `${packageName}-subscriber`,
      packageManager,
      version
    );

    // Verify subscription is active before unpublishing
    let subscriberPackageJson = await TestProjectUtils.readPackageJson(subscriberPath);
    expect(subscriberPackageJson.dependencies?.[packageName]).toMatch(
      TestProjectUtils.getLocalVersionPattern(version, publisherPath)
    );

    // Unpublish from publisher directory (current directory)
    TestProjectUtils.changeToProject(publisherPath);
    await UnpublishCommand.execute();

    // Verify the publishing directory was removed from the local store
    const store = await LocalPackageStoreService.getStore();
    const packageEntry = LocalPackageStoreService.getPackageEntry(
      store,
      packageName,
      publisherPath
    );
    expect(packageEntry).toBeNull();

    // Verify subscriber was reset to original version
    subscriberPackageJson = await TestProjectUtils.readPackageJson(subscriberPath);
    expect(subscriberPackageJson.dependencies?.[packageName]).toBe(version);

    // Verify publisher's package.json was reset to original version
    const publisherPackageJson = await TestProjectUtils.readPackageJson(publisherPath);
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
  const testUnpublishByName = async (packageManager: PackageManager, version: string) => {
    // Create and setup publisher and subscriber
    const packageName = `@test-${testId}/${packageManager}-unpublish-by-name`;
    const { publisherPath, subscriberPath } = await TestProjectUtils.publishAndSubscribe(
      packageName,
      `${packageName}-subscriber`,
      packageManager,
      version
    );

    // Change to a different directory (not the publisher directory)
    const otherDir = path.join(TestProjectUtils.getTestInstanceDir(), 'other-dir');
    await fs.ensureDir(otherDir);
    TestProjectUtils.changeToProject(otherDir);

    // Unpublish by package name
    await UnpublishCommand.execute(packageName);

    // Verify the publishing directory was removed from the local store
    const store = await LocalPackageStoreService.getStore();
    const packageEntry = LocalPackageStoreService.getPackageEntry(
      store,
      packageName,
      publisherPath
    );
    expect(packageEntry).toBeNull();

    // Verify subscriber was reset to original version
    const subscriberPackageJson = await TestProjectUtils.readPackageJson(subscriberPath);
    expect(subscriberPackageJson.dependencies?.[packageName]).toBe(version);

    // Verify publisher's package.json was NOT modified (since we weren't in that directory)
    const publisherPackageJson = await TestProjectUtils.readPackageJson(publisherPath);
    expect(publisherPackageJson.version).toMatch(version);

    // Verify success message was logged
    expect(DR.logger.info).toHaveBeenCalledWith(
      `Successfully unpublished ${packageName} and reset all subscribers`
    );
  };
});
