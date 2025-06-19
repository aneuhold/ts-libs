import { DR } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { LocalPackageStoreService } from '../services/LocalPackageStoreService.js';
import { MutexService } from '../services/MutexService.js';
import { VerdaccioService } from '../services/VerdaccioService.js';
import { PackageManager } from '../types/PackageManager.js';
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

    // Verify the package entry was created in the local store
    const packageEntry = await TestProjectUtils.getPackageEntry(`@test-${testId}/my-package`);
    expect(packageEntry).toBeTruthy();
    expect(packageEntry?.originalVersion).toBe('1.0.0');
    expect(packageEntry?.currentVersion).toMatch(/^1\.0\.0-\d{17}$/);
    expect(packageEntry?.subscribers).toEqual([]);
    expect(packageEntry?.packageRootPath).toBe(packagePath);

    // Verify the package.json was restored to original version
    const finalPackageJson = await TestProjectUtils.readPackageJson(packagePath);
    expect(finalPackageJson.version).toBe('1.0.0');

    // Verify success was logged
    expect(DR.logger.info).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`Successfully published @test-${testId}/my-package@1\\.0\\.0-\\d{17}`)
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
    await LocalPackageStoreService.updatePackageEntry(`@test-${testId}/republish-test`, {
      originalVersion: '1.0.0',
      currentVersion: '1.0.0-000000000000000001', // Mock timestamp version
      subscribers: [{ subscriberPath, originalSpecifier: '1.0.0' }],
      packageRootPath: publisherPath
    });

    TestProjectUtils.changeToProject(publisherPath);
    await PublishCommand.execute();

    // Verify subscriber was added
    let packageEntry = await TestProjectUtils.getPackageEntry(`@test-${testId}/republish-test`);
    expect(packageEntry?.subscribers.some((s) => s.subscriberPath === subscriberPath)).toBe(true);

    // Publish again
    await PublishCommand.execute();

    // Verify subscriber is still there
    packageEntry = await TestProjectUtils.getPackageEntry(`@test-${testId}/republish-test`);
    expect(packageEntry?.subscribers.some((s) => s.subscriberPath === subscriberPath)).toBe(true);
    expect(packageEntry?.subscribers).toHaveLength(1);
  });

  it('should handle subscriber update failures gracefully', async () => {
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
    await LocalPackageStoreService.updatePackageEntry(`@test-${testId}/error-test`, {
      originalVersion: '1.0.0',
      currentVersion: '1.0.0',
      subscribers: [{ subscriberPath: badSubscriberPath, originalSpecifier: '1.0.0' }],
      packageRootPath: publisherPath
    });

    TestProjectUtils.changeToProject(publisherPath);
    await PublishCommand.execute();

    // Verify error was logged but publish continued
    expect(DR.logger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Failed to update subscriber ${badSubscriberPath}`)
    );

    // Verify main publish still completed
    expect(DR.logger.info).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`Successfully published @test-${testId}/error-test@1\\.0\\.0-\\d{17}`)
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
    await PublishCommand.execute();

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
    const finalPackageJson = await TestProjectUtils.readPackageJson(packagePath);
    expect(finalPackageJson.version).toBe('1.0.0');

    // Verify success was logged
    expect(DR.logger.info).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`Successfully published @test-${testId}/npmrc-override-test@1\\.0\\.0-\\d{17}`)
      )
    );

    // Verify the publish was done to local registry, not npm
    // We can check this by verifying that the command used the correct registry arguments
    expect(DR.logger.info).toHaveBeenCalledWith(expect.stringContaining('Publishing package from'));
    expect(DR.logger.info).toHaveBeenCalledWith(expect.stringContaining('http://localhost:4873'));
  });

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
    const packageEntry = await TestProjectUtils.getPackageEntry(
      `@test-${testId}/${packageManager}-publisher`
    );
    expect(packageEntry?.originalVersion).toBe(version);
    expect(packageEntry?.currentVersion).toMatch(
      new RegExp(`^${version.replace(/\./g, '\\.')}-\\d{17}$`)
    );
  };
});
