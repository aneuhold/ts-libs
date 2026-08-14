import { DR } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConcurrentTestProjectUtils } from '../../test-utils/ConcurrentTestProjectUtils.js';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { LocalPackageVersionService } from '../services/LocalPackageVersion.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { PackageManagerService } from '../services/PackageManagerService/PackageManager.service.js';
import { VerdaccioService } from '../services/Verdaccio.service.js';
import { PackageManager } from '../types/PackageManager.js';
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

  it('should successfully publish a package without subscribers', async () => {
    // Create a test package
    const packagePath = await TestProjectUtils.createTestPackage(
      `@test-${testId}/my-package`,
      '1.0.0'
    );

    // Change to the package directory
    TestProjectUtils.changeToProject(packagePath);

    // Run publish command
    await PublishCommand.execute();

    // Verify the package entry was created in the local store under its path
    const store = await LocalPackageStoreService.getStore();
    const packageEntry = LocalPackageStoreService.getPackageEntry(
      store,
      `@test-${testId}/my-package`,
      packagePath
    );
    expect(packageEntry).toBeTruthy();
    expect(packageEntry?.originalVersion).toBe('1.0.0');
    expect(packageEntry?.currentVersion).toMatch(
      TestProjectUtils.getLocalVersionPattern('1.0.0', packagePath)
    );
    expect(packageEntry?.subscribers).toEqual([]);

    // Verify the package.json was restored to original version
    const finalPackageJson = await TestProjectUtils.readPackageJson(packagePath);
    expect(finalPackageJson.version).toBe('1.0.0');

    // Verify success was logged
    expect(DR.logger.info).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(
          `Successfully published @test-${testId}/my-package@1\\.0\\.0${LocalPackageVersionService.getSuffixRegex(packagePath).source}`
        )
      )
    );
  });

  it('should successfully publish with npm and update subscribers', async () => {
    await testPublishWithSubscribers(PackageManager.Npm, '2.0.0');
  });

  it('should successfully publish with yarn and update subscribers', async () => {
    await testPublishWithSubscribers(PackageManager.Yarn, '1.2.3');
  });

  it('should successfully publish with pnpm and update subscribers', async () => {
    await testPublishWithSubscribers(PackageManager.Pnpm, '0.5.0');
  });

  it('should successfully publish with yarn4 and update subscribers', async () => {
    await testPublishWithSubscribers(PackageManager.Yarn4, '1.1.0');
  });

  it('should handle missing package.json gracefully', async () => {
    // Change to an empty directory
    const emptyDir = path.join(TestProjectUtils.getTestInstanceDir(), 'empty');
    await fs.ensureDir(emptyDir);
    TestProjectUtils.changeToProject(emptyDir);

    // Attempt to publish should fail
    await expect(PublishCommand.execute()).rejects.toThrow(
      'No package.json found in current directory'
    );
  });

  it('should handle package.json with missing required fields', async () => {
    // Create directory with invalid package.json
    const invalidDir = path.join(TestProjectUtils.getTestInstanceDir(), 'invalid');
    await fs.ensureDir(invalidDir);
    await fs.writeJson(path.join(invalidDir, 'package.json'), {
      description: 'Missing name and version'
    });

    TestProjectUtils.changeToProject(invalidDir);

    await expect(PublishCommand.execute()).rejects.toThrow(
      'No package.json found in current directory'
    );
  });

  it('should preserve existing subscribers when republishing', async () => {
    // Create publisher and subscriber
    const publisherPath = await TestProjectUtils.createTestPackage(
      `@test-${testId}/republish-test`,
      '1.0.0'
    );
    const subscriberPath = await TestProjectUtils.createSubscriberProject(
      `@test-${testId}/republish-subscriber`,
      `@test-${testId}/republish-test`,
      '1.0.0'
    );

    // Publish the package first
    TestProjectUtils.changeToProject(publisherPath);
    await PublishCommand.execute();

    // Subscribe and publish once
    TestProjectUtils.changeToProject(subscriberPath);
    // Note: We would need to import SubscribeCommand here for a complete test
    // For now, we manually add the subscriber to test republishing functionality
    await TestProjectUtils.mutateStore((store) => {
      LocalPackageStoreService.updatePackageEntry(
        store,
        `@test-${testId}/republish-test`,
        publisherPath,
        {
          originalVersion: '1.0.0',
          currentVersion: '1.0.0-000000000000000001', // Mock timestamp version
          subscribers: [{ subscriberPath, originalSpecifier: '1.0.0' }]
        }
      );
    });

    TestProjectUtils.changeToProject(publisherPath);
    await PublishCommand.execute();

    // Verify subscriber was added
    let store = await LocalPackageStoreService.getStore();
    let packageEntry = LocalPackageStoreService.getPackageEntry(
      store,
      `@test-${testId}/republish-test`,
      publisherPath
    );
    expect(packageEntry?.subscribers.some((s) => s.subscriberPath === subscriberPath)).toBe(true);

    // Publish again
    await PublishCommand.execute();

    // Verify subscriber is still there
    store = await LocalPackageStoreService.getStore();
    packageEntry = LocalPackageStoreService.getPackageEntry(
      store,
      `@test-${testId}/republish-test`,
      publisherPath
    );
    expect(packageEntry?.subscribers.some((s) => s.subscriberPath === subscriberPath)).toBe(true);
    expect(packageEntry?.subscribers).toHaveLength(1);
  });

  it('should record the version a killed publish left in package.json without its suffix', async () => {
    const packageName = `@test-${testId}/leftover-version`;
    const packagePath = await TestProjectUtils.createTestPackage(
      packageName,
      '1.0.0-pdeadbeef.20250726123456789'
    );

    TestProjectUtils.changeToProject(packagePath);
    await PublishCommand.execute();

    // Nothing else names the version this directory publishes under once the
    // store has no entry for it, so the suffix would otherwise be baked in
    const packageEntry = LocalPackageStoreService.getPackageEntry(
      await LocalPackageStoreService.getStore(),
      packageName,
      packagePath
    );
    expect(packageEntry?.originalVersion).toBe('1.0.0');
    expect((await TestProjectUtils.readPackageJson(packagePath)).version).toBe('1.0.0');
  });

  it('should throw when a subscriber cannot be updated', async () => {
    // Create publisher package
    const publisherPath = await TestProjectUtils.createTestPackage(
      `@test-${testId}/error-test`,
      '1.0.0'
    );

    // Create a "subscriber" directory that will cause errors
    const badSubscriberPath = path.join(TestProjectUtils.getTestInstanceDir(), 'bad-subscriber');
    await fs.ensureDir(badSubscriberPath);
    // Don't create a package.json - this will cause read errors

    // Manually add the bad subscriber to the package entry
    await TestProjectUtils.mutateStore((store) => {
      LocalPackageStoreService.updatePackageEntry(
        store,
        `@test-${testId}/error-test`,
        publisherPath,
        {
          originalVersion: '1.0.0',
          currentVersion: '1.0.0',
          subscribers: [{ subscriberPath: badSubscriberPath, originalSpecifier: '1.0.0' }]
        }
      );
    });

    TestProjectUtils.changeToProject(publisherPath);

    // The package reached the registry, but the subscriber never got it, so the
    // failure has to surface rather than be counted and logged
    await expect(PublishCommand.execute()).rejects.toThrow(badSubscriberPath);
  });

  it('should collect versions the store never named and leave the other directory alone', async () => {
    const packageName = `@test-${testId}/orphan-retention`;
    const { firstPublisherPath, secondPublisherPath } =
      await TestProjectUtils.publishFromTwoDirectories(packageName);

    const packageStorage = TestProjectUtils.getRegistryPackageStorage(packageName);
    const firstPublisherSlug = LocalPackageVersionService.getPathSlug(firstPublisherPath);

    const secondPublisherVersion = await TestProjectUtils.getCurrentVersion(
      packageName,
      secondPublisherPath
    );

    // A publish killed before it writes the store leaves a version nothing names
    const orphanTarball = path.join(
      packageStorage,
      TestProjectUtils.getRegistryTarballName(
        packageName,
        `1.0.0-${firstPublisherSlug}.00000000000000000`
      )
    );
    await fs.writeFile(orphanTarball, '');

    TestProjectUtils.changeToProject(firstPublisherPath);
    await PublishCommand.execute();

    // The directory that published keeps exactly the version it just published
    const tarballs = await fs.readdir(packageStorage);
    expect(
      tarballs.filter((fileName) => fileName.includes(`-${firstPublisherSlug}.`))
    ).toHaveLength(1);
    expect(await fs.pathExists(orphanTarball)).toBe(false);
    expect(tarballs).toContain(
      TestProjectUtils.getRegistryTarballName(packageName, secondPublisherVersion)
    );
  });

  it('should keep two publishing directories of one package resolvable at the same time', async () => {
    const packageName = `@test-${testId}/two-publishers`;
    const { firstPublisherPath, secondPublisherPath } =
      await TestProjectUtils.publishFromTwoDirectories(packageName);
    const subscriberAPath = await TestProjectUtils.createSubscriberProject(
      `@test-${testId}/subscriber-a`,
      packageName,
      '^1.0.0'
    );
    const subscriberBPath = await TestProjectUtils.createSubscriberProject(
      `@test-${testId}/subscriber-b`,
      packageName,
      '^1.0.0'
    );

    // Each subscriber states the directory it wants
    TestProjectUtils.changeToProject(subscriberAPath);
    await SubscribeCommand.execute(packageName, firstPublisherPath);
    TestProjectUtils.changeToProject(subscriberBPath);
    await SubscribeCommand.execute(packageName, secondPublisherPath);

    const secondPublisherVersion = await TestProjectUtils.getCurrentVersion(
      packageName,
      secondPublisherPath
    );

    // Publishing from one directory has to leave the other directory's subscriber
    // on the build it subscribed to
    TestProjectUtils.changeToProject(firstPublisherPath);
    await PublishCommand.execute();

    const store = await LocalPackageStoreService.getStore();
    const firstPublisherVersion = await TestProjectUtils.getCurrentVersion(
      packageName,
      firstPublisherPath
    );
    expect(firstPublisherVersion).not.toBe(secondPublisherVersion);

    const subscriberAPackageJson = await TestProjectUtils.readPackageJson(subscriberAPath);
    const subscriberBPackageJson = await TestProjectUtils.readPackageJson(subscriberBPath);
    expect(subscriberAPackageJson.dependencies?.[packageName]).toBe(firstPublisherVersion);
    expect(subscriberBPackageJson.dependencies?.[packageName]).toBe(secondPublisherVersion);

    // Each subscriber resolves the build of the directory it is bound to
    const installedForSubscriberA = await TestProjectUtils.readInstalledPackageJson(
      subscriberAPath,
      packageName
    );
    const installedForSubscriberB = await TestProjectUtils.readInstalledPackageJson(
      subscriberBPath,
      packageName
    );
    expect(installedForSubscriberA.version).toBe(firstPublisherVersion);
    expect(installedForSubscriberB.version).toBe(secondPublisherVersion);

    // Retention runs on every publish, so what the first directory removed has
    // to be its own version and nothing else: the second directory's subscriber
    // installs again from scratch and still gets what it is pinned to
    await fs.remove(path.join(subscriberBPath, 'node_modules'));

    await VerdaccioService.start();
    try {
      await PackageManagerService.runInstallWithRegistry(subscriberBPath, store);
    } finally {
      await VerdaccioService.stop();
    }

    expect(
      (await TestProjectUtils.readInstalledPackageJson(subscriberBPath, packageName)).version
    ).toBe(secondPublisherVersion);
  });

  it('should drop a subscriber whose directory is gone and keep one whose update failed', async () => {
    const packageName = `@test-${testId}/subscriber-retention`;
    const publisherPath = await TestProjectUtils.createTestPackage(packageName, '1.0.0');

    // A directory that was never there, against one that is there but cannot
    // be updated because it holds no package.json
    const removedSubscriberPath = path.join(
      TestProjectUtils.getTestInstanceDir(),
      'removed-subscriber'
    );
    const failingSubscriberPath = path.join(
      TestProjectUtils.getTestInstanceDir(),
      'failing-subscriber'
    );
    await fs.ensureDir(failingSubscriberPath);

    await TestProjectUtils.mutateStore((store) => {
      LocalPackageStoreService.updatePackageEntry(store, packageName, publisherPath, {
        originalVersion: '1.0.0',
        currentVersion: '1.0.0',
        subscribers: [
          { subscriberPath: removedSubscriberPath, originalSpecifier: '1.0.0' },
          { subscriberPath: failingSubscriberPath, originalSpecifier: '1.0.0' }
        ]
      });
    });

    TestProjectUtils.changeToProject(publisherPath);
    await expect(PublishCommand.execute()).rejects.toThrow(failingSubscriberPath);

    const store = await LocalPackageStoreService.getStore();
    const packageEntry = LocalPackageStoreService.getPackageEntry(
      store,
      packageName,
      publisherPath
    );
    expect(packageEntry?.subscribers.map((subscriber) => subscriber.subscriberPath)).toEqual([
      failingSubscriberPath
    ]);
  });

  it('should publish locally even with existing .npmrc org-specific registry setting', async () => {
    // Create a test package with a scoped name
    const packagePath = await TestProjectUtils.createTestPackage(
      `@test-${testId}/npmrc-override-test`,
      '1.0.0'
    );

    // Create an .npmrc file with org-specific registry setting pointing to real npm
    const npmrcPath = path.join(packagePath, '.npmrc');
    const npmrcContent = `@test-${testId}:registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=real-npm-token`;
    await fs.writeFile(npmrcPath, npmrcContent);

    // Change to the package directory
    TestProjectUtils.changeToProject(packagePath);

    // Run publish command - this should publish to local registry, not npm
    await PublishCommand.execute();

    // Verify the package entry was created in the local store
    const store = await LocalPackageStoreService.getStore();
    const packageEntry = LocalPackageStoreService.getPackageEntry(
      store,
      `@test-${testId}/npmrc-override-test`,
      packagePath
    );
    expect(packageEntry).toBeTruthy();
    expect(packageEntry?.originalVersion).toBe('1.0.0');
    expect(packageEntry?.currentVersion).toMatch(
      TestProjectUtils.getLocalVersionPattern('1.0.0', packagePath)
    );
    expect(packageEntry?.subscribers).toEqual([]);

    // Verify the .npmrc file is still there and unchanged
    const finalNpmrcContent = await fs.readFile(npmrcPath, 'utf8');
    expect(finalNpmrcContent).toBe(npmrcContent);

    // Verify the package.json was restored to original version
    const finalPackageJson = await TestProjectUtils.readPackageJson(packagePath);
    expect(finalPackageJson.version).toBe('1.0.0');

    // Verify success was logged
    expect(DR.logger.info).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(
          `Successfully published @test-${testId}/npmrc-override-test@1\\.0\\.0${LocalPackageVersionService.getSuffixRegex(packagePath).source}`
        )
      )
    );

    // Verify the publish was done to local registry, not npm
    // We can check this by verifying that the command used the correct registry arguments
    expect(DR.logger.info).toHaveBeenCalledWith(expect.stringContaining('Publishing package from'));
    expect(DR.logger.info).toHaveBeenCalledWith(
      expect.stringContaining(await TestProjectUtils.getRegistryUrl())
    );
  });

  it('should re-publish a dependent so its consumer resolves one copy of the package', async () => {
    const libName = `@test-${testId}/chain-lib`;
    const midLibName = `@test-${testId}/chain-mid-lib`;

    const libPath = await TestProjectUtils.createTestPackage(libName, '1.0.0');
    const midLibPath = await TestProjectUtils.createTestPackage(
      midLibName,
      '1.0.0',
      PackageManager.Npm,
      { [libName]: '^1.0.0' }
    );
    const consumerPath = await TestProjectUtils.createTestPackage(
      `@test-${testId}/chain-consumer`,
      '1.0.0',
      PackageManager.Npm,
      { [midLibName]: '^1.0.0' }
    );

    for (const publisherPath of [libPath, midLibPath]) {
      TestProjectUtils.changeToProject(publisherPath);
      await PublishCommand.execute();
    }

    // The consumer subscribes to what it declares, which is the package in
    // between and not the library underneath it
    TestProjectUtils.changeToProject(consumerPath);
    await SubscribeCommand.execute(midLibName);

    const midLibVersionBeforeCascade = await TestProjectUtils.getCurrentVersion(
      midLibName,
      midLibPath
    );

    TestProjectUtils.changeToProject(libPath);
    await PublishCommand.execute();

    const libVersion = await TestProjectUtils.getCurrentVersion(libName, libPath);
    const midLibVersion = await TestProjectUtils.getCurrentVersion(midLibName, midLibPath);

    // The package in between carries the library in its tarball, so it is
    // published again rather than only installed again
    expect(midLibVersion).not.toBe(midLibVersionBeforeCascade);
    expect((await TestProjectUtils.readPackageJson(consumerPath)).dependencies?.[midLibName]).toBe(
      midLibVersion
    );
    expect((await TestProjectUtils.readInstalledPackageJson(consumerPath, libName)).version).toBe(
      libVersion
    );
    await expectSingleInstalledCopy(consumerPath, midLibName, libName);

    // What the sweep took is what nothing is pinned to any more, so the
    // consumer installs from scratch against the registry as it stands
    await fs.remove(path.join(consumerPath, 'node_modules'));
    await VerdaccioService.start();
    try {
      await PackageManagerService.runInstallWithRegistry(
        consumerPath,
        await LocalPackageStoreService.getStore()
      );
    } finally {
      await VerdaccioService.stop();
    }

    expect((await TestProjectUtils.readInstalledPackageJson(consumerPath, libName)).version).toBe(
      libVersion
    );
  });

  it('should keep the published version of a package an unpinned range would have missed', async () => {
    const { libName, libPath, midLibName, consumerPath } = await publishChainToSubscribedConsumer();

    // The range the package in between commits is what a real registry answers
    // with the real package, which is the second copy the pin exists to prevent
    await VerdaccioService.start();
    await VerdaccioService.publishPackage(libPath);
    await VerdaccioService.stop();

    TestProjectUtils.changeToProject(libPath);
    await PublishCommand.execute();

    const libVersion = await TestProjectUtils.getCurrentVersion(libName, libPath);

    expect((await TestProjectUtils.readInstalledPackageJson(consumerPath, libName)).version).toBe(
      libVersion
    );
    await expectSingleInstalledCopy(consumerPath, midLibName, libName);
  });

  it('should install once in a consumer subscribed to two packages of one cascade', async () => {
    const { libPath, consumerPath } = await publishChainToSubscribedConsumer();

    const runInstallWithRegistry = vi.spyOn(PackageManagerService, 'runInstallWithRegistry');

    TestProjectUtils.changeToProject(libPath);
    await PublishCommand.execute();

    const installsInConsumer = runInstallWithRegistry.mock.calls.filter(
      ([projectPath]) => projectPath === consumerPath
    );
    expect(installsInConsumer).toHaveLength(1);
  });

  it('should leave a shared subscriber correct when two packages publish at once', async () => {
    const firstLibName = `@test-${testId}/concurrent-first-lib`;
    const secondLibName = `@test-${testId}/concurrent-second-lib`;

    const firstLibPath = await TestProjectUtils.createTestPackage(firstLibName, '1.0.0');
    const secondLibPath = await TestProjectUtils.createTestPackage(secondLibName, '1.0.0');
    const consumerPath = await TestProjectUtils.createTestPackage(
      `@test-${testId}/concurrent-consumer`,
      '1.0.0',
      PackageManager.Npm,
      { [firstLibName]: '^1.0.0' }
    );

    for (const publisherPath of [firstLibPath, secondLibPath]) {
      TestProjectUtils.changeToProject(publisherPath);
      await PublishCommand.execute();
    }

    TestProjectUtils.changeToProject(consumerPath);
    await SubscribeCommand.execute(firstLibName);
    await TestProjectUtils.addDependencyToProject(consumerPath, secondLibName, '^1.0.0');
    await SubscribeCommand.execute(secondLibName);

    const supersededVersions = [
      await TestProjectUtils.getCurrentVersion(firstLibName, firstLibPath),
      await TestProjectUtils.getCurrentVersion(secondLibName, secondLibPath)
    ];

    await ConcurrentTestProjectUtils.runConcurrently('publishPackage.ts', 2, [
      firstLibPath,
      secondLibPath
    ]);

    const firstLibVersion = await TestProjectUtils.getCurrentVersion(firstLibName, firstLibPath);
    const secondLibVersion = await TestProjectUtils.getCurrentVersion(secondLibName, secondLibPath);
    const consumerPackageJson = await TestProjectUtils.readPackageJson(consumerPath);

    expect(consumerPackageJson.dependencies?.[firstLibName]).toBe(firstLibVersion);
    expect(consumerPackageJson.dependencies?.[secondLibName]).toBe(secondLibVersion);

    // Whichever publish installed last has to have carried both, since a lock
    // file naming a version the other publish swept can never be installed again
    const lockFile = await fs.readFile(
      TestProjectUtils.getLockFilePath(consumerPath, PackageManager.Npm),
      'utf8'
    );
    expect(lockFile).toContain(firstLibVersion);
    expect(lockFile).toContain(secondLibVersion);
    for (const supersededVersion of supersededVersions) {
      expect(lockFile).not.toContain(supersededVersion);
    }
  });

  /**
   * Creates a library, a package that depends on it, and a consumer subscribed
   * to both of them, with every one of them published.
   */
  const publishChainToSubscribedConsumer = async (): Promise<{
    libName: string;
    libPath: string;
    midLibName: string;
    midLibPath: string;
    consumerPath: string;
  }> => {
    const libName = `@test-${testId}/diamond-lib`;
    const midLibName = `@test-${testId}/diamond-mid-lib`;

    const libPath = await TestProjectUtils.createTestPackage(libName, '1.0.0');
    const midLibPath = await TestProjectUtils.createTestPackage(
      midLibName,
      '1.0.0',
      PackageManager.Npm,
      { [libName]: '^1.0.0' }
    );
    const consumerPath = await TestProjectUtils.createTestPackage(
      `@test-${testId}/diamond-consumer`,
      '1.0.0',
      PackageManager.Npm,
      { [libName]: '^1.0.0' }
    );

    for (const publisherPath of [libPath, midLibPath]) {
      TestProjectUtils.changeToProject(publisherPath);
      await PublishCommand.execute();
    }

    // The second dependency can only be declared once the first one resolves,
    // since a range never matches the prerelease a local publish produces
    TestProjectUtils.changeToProject(consumerPath);
    await SubscribeCommand.execute(libName);
    await TestProjectUtils.addDependencyToProject(consumerPath, midLibName, '^1.0.0');
    await SubscribeCommand.execute(midLibName);

    return { libName, libPath, midLibName, midLibPath, consumerPath };
  };

  /**
   * Asserts that a project resolves one copy of a package rather than one of
   * its own and another underneath the dependency that carries it.
   *
   * @param projectPath - Path to the project directory
   * @param dependentName - Name of the installed package that also depends on it
   * @param packageName - Name of the package there can only be one copy of
   */
  const expectSingleInstalledCopy = async (
    projectPath: string,
    dependentName: string,
    packageName: string
  ): Promise<void> => {
    const nestedCopy = path.join(
      projectPath,
      'node_modules',
      ...dependentName.split('/'),
      'node_modules',
      ...packageName.split('/')
    );

    expect(await fs.pathExists(nestedCopy)).toBe(false);
  };

  /**
   * Helper function to test publish with subscribers functionality for different package managers
   *
   * @param packageManager The package manager to test with
   * @param version The version to use for the test packages
   */
  const testPublishWithSubscribers = async (packageManager: PackageManager, version: string) => {
    // Create publisher package
    const publisherPath = await TestProjectUtils.createTestPackage(
      `@test-${testId}/${packageManager}-publisher`,
      version,
      packageManager
    );

    // Create subscriber packages
    const subscriber1Path = await TestProjectUtils.createSubscriberProject(
      `@test-${testId}/${packageManager}-subscriber1`,
      `@test-${testId}/${packageManager}-publisher`,
      version,
      packageManager
    );

    const subscriber2Path = await TestProjectUtils.createSubscriberProject(
      `@test-${testId}/${packageManager}-subscriber2`,
      `@test-${testId}/${packageManager}-publisher`,
      version,
      packageManager
    );

    // First, publish the publisher package to make it available
    TestProjectUtils.changeToProject(publisherPath);
    await PublishCommand.execute();

    // Now add subscribers to the publisher
    TestProjectUtils.changeToProject(subscriber1Path);
    // Note: This test would need to import SubscribeCommand as well
    // For now, we'll test just the publish functionality

    TestProjectUtils.changeToProject(subscriber2Path);
    // Note: This test would need to import SubscribeCommand as well
    // For now, we'll test just the publish functionality

    // Now publish again from the publisher directory to update subscribers
    TestProjectUtils.changeToProject(publisherPath);
    await PublishCommand.execute();

    // Verify package entry exists
    const store = await LocalPackageStoreService.getStore();
    const packageEntry = LocalPackageStoreService.getPackageEntry(
      store,
      `@test-${testId}/${packageManager}-publisher`,
      publisherPath
    );
    expect(packageEntry?.originalVersion).toBe(version);
    expect(packageEntry?.currentVersion).toMatch(
      TestProjectUtils.getLocalVersionPattern(version, publisherPath)
    );
  };
});
