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

describe('Integration Tests', () => {
  let testId: string;

  // Global setup/teardown for the tmp directory
  beforeAll(async () => {
    await TestProjectUtils.setupGlobalTempDir();
    // Ensure no mutex lock exists before starting tests
    try {
      await MutexService.forceReleaseLock();
    } catch {
      // Ignore errors if no lock exists
    }
  });

  afterAll(async () => {
    await TestProjectUtils.cleanupGlobalTempDir();
    // Clean up any remaining mutex lock
    try {
      await VerdaccioService.stop();
      await MutexService.forceReleaseLock();
    } catch {
      // Ignore errors during cleanup
    }
  });

  // Per-test setup/teardown for unique test instances
  beforeEach(async () => {
    vi.clearAllMocks();
    await TestProjectUtils.setupTestInstance();
    testId = randomUUID().slice(0, 8);
    // Ensure clean mutex state for each test
    try {
      await VerdaccioService.stop();
      await MutexService.forceReleaseLock();
    } catch {
      // Ignore errors if no lock exists or server wasn't running
    }
  });

  afterEach(async () => {
    await TestProjectUtils.cleanupTestInstance();
    // Clean up mutex lock after each test
    try {
      await VerdaccioService.stop();
      await MutexService.forceReleaseLock();
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
      expect(packageEntry?.subscribers).toContain(subscriberPath);

      // Publish again
      await CommandService.publish();

      // Verify subscriber is still there
      packageEntry = await TestProjectUtils.getPackageEntry(
        `@test-${testId}/republish-test`
      );
      expect(packageEntry?.subscribers).toContain(subscriberPath);
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
          subscribers: [badSubscriberPath],
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
      expect(packageEntry?.subscribers).toContain(subscriber1Path);
      expect(packageEntry?.subscribers).toContain(subscriber2Path);
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
        `^${version.replace(/\./g, '\\.')}-\\d{17}$`
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
        '1.0.0'
      );

      // Subscribe from subscriber directory
      TestProjectUtils.changeToProject(subscriberPath);
      await CommandService.subscribe(`@test-${testId}/subscribe-target`);

      // Verify subscriber was added
      const packageEntry = await TestProjectUtils.getPackageEntry(
        `@test-${testId}/subscribe-target`
      );
      expect(packageEntry?.subscribers).toContain(subscriberPath);
    });
  });
});
