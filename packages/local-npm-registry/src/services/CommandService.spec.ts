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
import { PackageManager } from '../types/PackageManager.js';
import { CommandService } from './CommandService.js';
import { LocalPackageStoreService } from './LocalPackageStoreService.js';
import { MutexService } from './MutexService.js';
import { VerdaccioService } from './VerdaccioService.js';

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

  describe('publish', () => {
    it('should successfully publish a package without subscribers', async () => {
      // Create a test package
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/my-package`,
        '1.0.0'
      );

      // Change to the package directory
      TestProjectUtils.changeToProject(packagePath);

      // Run publish command
      await CommandService.publish();

      // Verify the package entry was created in the local store
      const packageEntry = await TestProjectUtils.getPackageEntry(
        `@test-${testId}/my-package`
      );
      expect(packageEntry).toBeTruthy();
      expect(packageEntry?.originalVersion).toBe('1.0.0');
      expect(packageEntry?.currentVersion).toMatch(/^1\.0\.0-\d{17}$/);
      expect(packageEntry?.subscribers).toEqual([]);
      expect(packageEntry?.packageRootPath).toBe(packagePath);

      // Verify the package.json was restored to original version
      const finalPackageJson =
        await TestProjectUtils.readPackageJson(packagePath);
      expect(finalPackageJson.version).toBe('1.0.0');

      // Verify success was logged
      expect(DR.logger.info).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(
            `Successfully published @test-${testId}/my-package@1\\.0\\.0-\\d{17}`
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
      const emptyDir = path.join(
        TestProjectUtils.getTestInstanceDir(),
        'empty'
      );
      await fs.ensureDir(emptyDir);
      TestProjectUtils.changeToProject(emptyDir);

      // Attempt to publish should fail
      await expect(CommandService.publish()).rejects.toThrow(
        'No package.json found in current directory'
      );
    });

    it('should handle package.json with missing required fields', async () => {
      // Create directory with invalid package.json
      const invalidDir = path.join(
        TestProjectUtils.getTestInstanceDir(),
        'invalid'
      );
      await fs.ensureDir(invalidDir);
      await fs.writeJson(path.join(invalidDir, 'package.json'), {
        description: 'Missing name and version'
      });

      TestProjectUtils.changeToProject(invalidDir);

      await expect(CommandService.publish()).rejects.toThrow(
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
      await CommandService.publish();

      // Subscribe and publish once
      TestProjectUtils.changeToProject(subscriberPath);
      await CommandService.subscribe(`@test-${testId}/republish-test`);

      TestProjectUtils.changeToProject(publisherPath);
      await CommandService.publish();

      // Verify subscriber was added
      let packageEntry = await TestProjectUtils.getPackageEntry(
        `@test-${testId}/republish-test`
      );
      expect(
        packageEntry?.subscribers.some(
          (s) => s.subscriberPath === subscriberPath
        )
      ).toBe(true);

      // Publish again
      await CommandService.publish();

      // Verify subscriber is still there
      packageEntry = await TestProjectUtils.getPackageEntry(
        `@test-${testId}/republish-test`
      );
      expect(
        packageEntry?.subscribers.some(
          (s) => s.subscriberPath === subscriberPath
        )
      ).toBe(true);
      expect(packageEntry?.subscribers).toHaveLength(1);
    });

    it('should handle subscriber update failures gracefully', async () => {
      // Create publisher package
      const publisherPath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/error-test`,
        '1.0.0'
      );

      // Create a "subscriber" directory that will cause errors
      const badSubscriberPath = path.join(
        TestProjectUtils.getTestInstanceDir(),
        'bad-subscriber'
      );
      await fs.ensureDir(badSubscriberPath);
      // Don't create a package.json - this will cause read errors

      // Manually add the bad subscriber to the package entry
      await LocalPackageStoreService.updatePackageEntry(
        `@test-${testId}/error-test`,
        {
          originalVersion: '1.0.0',
          currentVersion: '1.0.0',
          subscribers: [
            { subscriberPath: badSubscriberPath, originalSpecifier: '1.0.0' }
          ],
          packageRootPath: publisherPath
        }
      );

      TestProjectUtils.changeToProject(publisherPath);
      await CommandService.publish();

      // Verify error was logged but publish continued
      expect(DR.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Failed to update subscriber ${badSubscriberPath}`
        )
      );

      // Verify main publish still completed
      expect(DR.logger.info).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(
            `Successfully published @test-${testId}/error-test@1\\.0\\.0-\\d{17}`
          )
        )
      );
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
      await CommandService.publish();

      // Verify the package entry was created in the local store
      const packageEntry = await TestProjectUtils.getPackageEntry(
        `@test-${testId}/npmrc-override-test`
      );
      expect(packageEntry).toBeTruthy();
      expect(packageEntry?.originalVersion).toBe('1.0.0');
      expect(packageEntry?.currentVersion).toMatch(/^1\.0\.0-\d{17}$/);
      expect(packageEntry?.subscribers).toEqual([]);
      expect(packageEntry?.packageRootPath).toBe(packagePath);

      // Verify the .npmrc file is still there and unchanged
      const finalNpmrcContent = await fs.readFile(npmrcPath, 'utf8');
      expect(finalNpmrcContent).toBe(npmrcContent);

      // Verify the package.json was restored to original version
      const finalPackageJson =
        await TestProjectUtils.readPackageJson(packagePath);
      expect(finalPackageJson.version).toBe('1.0.0');

      // Verify success was logged
      expect(DR.logger.info).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(
            `Successfully published @test-${testId}/npmrc-override-test@1\\.0\\.0-\\d{17}`
          )
        )
      );

      // Verify the publish was done to local registry, not npm
      // We can check this by verifying that the command used the correct registry arguments
      expect(DR.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Publishing package from')
      );
      expect(DR.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:4873')
      );
    });

    /**
     * Helper function to test publish with subscribers functionality for different package managers
     *
     * @param packageManager The package manager to test with
     * @param version The version to use for the test packages
     */
    const testPublishWithSubscribers = async (
      packageManager: PackageManager,
      version: string
    ) => {
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
      await CommandService.publish();

      // Now add subscribers to the publisher
      TestProjectUtils.changeToProject(subscriber1Path);
      await CommandService.subscribe(
        `@test-${testId}/${packageManager}-publisher`
      );

      TestProjectUtils.changeToProject(subscriber2Path);
      await CommandService.subscribe(
        `@test-${testId}/${packageManager}-publisher`
      );

      // Now publish again from the publisher directory to update subscribers
      TestProjectUtils.changeToProject(publisherPath);
      await CommandService.publish();

      // Verify package entry has subscribers
      const packageEntry = await TestProjectUtils.getPackageEntry(
        `@test-${testId}/${packageManager}-publisher`
      );
      expect(
        packageEntry?.subscribers.some(
          (s) => s.subscriberPath === subscriber1Path
        )
      ).toBe(true);
      expect(
        packageEntry?.subscribers.some(
          (s) => s.subscriberPath === subscriber2Path
        )
      ).toBe(true);
      expect(packageEntry?.originalVersion).toBe(version);
      expect(packageEntry?.currentVersion).toMatch(
        new RegExp(`^${version.replace(/\./g, '\\.')}-\\d{17}$`)
      );

      // Verify subscribers were updated with timestamp version
      const subscriber1PackageJson =
        await TestProjectUtils.readPackageJson(subscriber1Path);
      const subscriber2PackageJson =
        await TestProjectUtils.readPackageJson(subscriber2Path);

      const versionPattern = new RegExp(
        `^\\^?${version.replace(/\./g, '\\.')}-\\d{17}$`
      );
      expect(
        subscriber1PackageJson.dependencies?.[
          `@test-${testId}/${packageManager}-publisher`
        ]
      ).toMatch(versionPattern);
      expect(
        subscriber2PackageJson.dependencies?.[
          `@test-${testId}/${packageManager}-publisher`
        ]
      ).toMatch(versionPattern);

      // Verify update message was logged
      expect(DR.logger.info).toHaveBeenCalledWith('Updating 2 subscriber(s)');

      // Verify subscribers have non-empty lock files
      await TestProjectUtils.validateSubscriberLockFiles(
        [subscriber1Path, subscriber2Path],
        packageManager
      );
    };
  });

  describe('subscribe', () => {
    it('should add current directory as subscriber to a package', async () => {
      // Create publisher package
      const publisherPath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/subscribe-target`,
        '1.0.0'
      );

      // Create and publish the target package first
      TestProjectUtils.changeToProject(publisherPath);
      await CommandService.publish();

      // Create subscriber package
      const subscriberPath = await TestProjectUtils.createSubscriberProject(
        `@test-${testId}/new-subscriber`,
        `@test-${testId}/subscribe-target`,
        '^1.0.0'
      );

      // Subscribe from subscriber directory
      TestProjectUtils.changeToProject(subscriberPath);
      await CommandService.subscribe(`@test-${testId}/subscribe-target`);

      // Verify subscriber was added
      const packageEntry = await TestProjectUtils.getPackageEntry(
        `@test-${testId}/subscribe-target`
      );
      expect(
        packageEntry?.subscribers.some(
          (s) =>
            s.subscriberPath === subscriberPath &&
            s.originalSpecifier === '^1.0.0'
        )
      ).toBe(true);
    });
  });

  describe('unsubscribe', () => {
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

    it('should handle unsubscribing from non-existent package', async () => {
      const subscriberPath = await TestProjectUtils.createSubscriberProject(
        `@test-${testId}/unsubscribe-test`,
        `@test-${testId}/non-existent`,
        '1.0.0'
      );

      TestProjectUtils.changeToProject(subscriberPath);

      await expect(
        CommandService.unsubscribe(`@test-${testId}/non-existent`)
      ).rejects.toThrow(
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
      await CommandService.publish();

      // Create a subscriber but don't actually subscribe
      const subscriberPath = await TestProjectUtils.createSubscriberProject(
        `@test-${testId}/unsubscribe-subscriber`,
        `@test-${testId}/unsubscribe-not-subscribed`,
        '1.0.0'
      );

      TestProjectUtils.changeToProject(subscriberPath);

      await expect(
        CommandService.unsubscribe(`@test-${testId}/unsubscribe-not-subscribed`)
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
      const { subscriberPath, packageName } = await setupPublisherAndSubscriber(
        packageManager,
        version,
        'unsubscribe-specific'
      );

      // Verify subscription is active (package has timestamp version)
      let subscriberPackageJson =
        await TestProjectUtils.readPackageJson(subscriberPath);
      const timestampPattern = new RegExp(
        `^${version.replace(/\./g, '\\.')}-\\d{17}$`
      );
      expect(subscriberPackageJson.dependencies?.[packageName]).toMatch(
        timestampPattern
      );

      // Unsubscribe from the package
      TestProjectUtils.changeToProject(subscriberPath);
      await CommandService.unsubscribe(packageName);

      // Verify package entry no longer has this subscriber
      const packageEntry = await TestProjectUtils.getPackageEntry(packageName);
      expect(
        packageEntry?.subscribers.some(
          (s) => s.subscriberPath === subscriberPath
        )
      ).toBe(false);

      // Verify subscriber's package.json was reset to original version
      subscriberPackageJson =
        await TestProjectUtils.readPackageJson(subscriberPath);
      expect(subscriberPackageJson.dependencies?.[packageName]).toBe(version);

      // Verify success message was logged
      expect(DR.logger.info).toHaveBeenCalledWith(
        `Successfully unsubscribed from ${packageName}`
      );
    };
  });

  describe('unpublish', () => {
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
        CommandService.unpublish(`@test-${testId}/non-existent`)
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

      await expect(CommandService.unpublish()).rejects.toThrow(
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
      await CommandService.unpublish();

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
      await CommandService.unpublish(packageName);

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
  });

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
    await CommandService.publish();

    // Subscribe to the package
    TestProjectUtils.changeToProject(subscriberPath);
    await CommandService.subscribe(packageName);

    return {
      publisherPath,
      subscriberPath,
      packageName
    };
  };
});
