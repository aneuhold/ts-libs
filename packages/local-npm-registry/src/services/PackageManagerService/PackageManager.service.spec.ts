import { DR, isPackageJson } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProjectUtils } from '../../../test-utils/TestProjectUtils.js';
import { MutexLockName } from '../../types/MutexLockName.js';
import { PACKAGE_MANAGER_INFO, PackageManager } from '../../types/PackageManager.js';
import { LocalPackageStoreService } from '../LocalPackageStore.service.js';
import { MutexService } from '../Mutex.service.js';
import { VerdaccioService } from '../Verdaccio.service.js';
import { PackageManagerService } from './PackageManager.service.js';

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

describe('Unit Tests', () => {
  let testId: string;

  // Global setup/teardown for the tmp directory
  beforeAll(async () => {
    await TestProjectUtils.setupGlobalTempDir();
  });

  afterAll(async () => {
    await TestProjectUtils.cleanupGlobalTempDir();

    try {
      await VerdaccioService.stop();
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
      await MutexService.forceReleaseLock(MutexLockName.Verdaccio);
    } catch {
      // Ignore errors if no lock exists or server wasn't running
    }
  });

  afterEach(async () => {
    await TestProjectUtils.cleanupTestInstance();
    // Clean up mutex lock after each test
    try {
      await MutexService.forceReleaseLock(MutexLockName.Verdaccio);
      await VerdaccioService.stop();
    } catch {
      // Ignore errors during cleanup
    }
  });

  describe('detectPackageManager', () => {
    it('should detect npm from package-lock.json', async () => {
      await testPackageManagerDetection('npm-detect', PackageManager.Npm);
    });

    it('should detect pnpm from pnpm-lock.yaml', async () => {
      await testPackageManagerDetection('pnpm-detect', PackageManager.Pnpm);
    });

    it('should detect yarn from yarn.lock', async () => {
      await testPackageManagerDetection('yarn-detect', PackageManager.Yarn);
    });

    it('should detect yarn4 from yarn.lock and packageManager field', async () => {
      await testPackageManagerDetection('yarn4-detect', PackageManager.Yarn4);
    });

    it('should default to npm when no lock files exist', async () => {
      const emptyDir = path.join(TestProjectUtils.getTestInstanceDir(), 'no-locks');
      await fs.ensureDir(emptyDir);

      // Create a basic package.json without lock files
      await fs.writeJson(path.join(emptyDir, 'package.json'), {
        name: `@test-${testId}/no-locks`,
        version: '1.0.0'
      });

      const packageManager = await PackageManagerService.detectPackageManager(emptyDir);

      expect(packageManager).toBe(PackageManager.Npm);
    });

    it('should prioritize packageManager field over lock file detection', async () => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/override-test`,
        '1.0.0',
        PackageManager.Npm // This will create package-lock.json
      );

      // Override the package.json to specify pnpm as packageManager
      const packageJsonPath = path.join(packagePath, 'package.json');
      const rawPackageJson: unknown = await fs.readJson(packageJsonPath);
      if (!isPackageJson(rawPackageJson)) {
        throw new Error('Test package.json did not match PackageJson shape');
      }
      rawPackageJson.packageManager = 'pnpm@8.0.0';
      await fs.writeJson(packageJsonPath, rawPackageJson);

      const packageManager = await PackageManagerService.detectPackageManager(packagePath);

      // Should detect pnpm from packageManager field despite npm lock file
      expect(packageManager).toBe(PackageManager.Pnpm);
    });

    /**
     * Helper function to test package manager detection
     *
     * @param suffix The suffix for the package name
     * @param expectedManager The expected package manager to be detected
     */
    const testPackageManagerDetection = async (suffix: string, expectedManager: PackageManager) => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/${suffix}`,
        '1.0.0',
        expectedManager
      );

      const packageManager = await PackageManagerService.detectPackageManager(packagePath);

      expect(packageManager).toBe(expectedManager);
    };
  });

  describe('runInstallWithRegistry', () => {
    beforeEach(async () => {
      // Start Verdaccio before running install tests
      await VerdaccioService.start();
    });

    it('should successfully run install with npm', async () => {
      await testInstallWithPackageManager(PackageManager.Npm, 'Running npm install');
    });

    it('should successfully run install with pnpm', async () => {
      await testInstallWithPackageManager(PackageManager.Pnpm, 'Running pnpm install');
    });

    it('should successfully run install with yarn', async () => {
      await testInstallWithPackageManager(PackageManager.Yarn, 'Running Yarn Classic install');
    });

    it('should use custom registry URL when provided', async () => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/custom-registry`,
        '1.0.0',
        PackageManager.Npm
      );

      const customRegistryUrl = 'http://localhost:9999';

      // This will likely fail since the custom registry doesn't exist,
      // but we can verify the configuration was created with the right URL
      try {
        await PackageManagerService.runInstallWithRegistry(
          packagePath,
          await LocalPackageStoreService.getStore(),
          customRegistryUrl
        );
      } catch {
        // Expected to fail since registry doesn't exist
      }

      // During the test, the configuration would have been created and then restored
      // We can verify the process attempted to use the custom URL by checking logs
      expect(DR.logger.info).toHaveBeenCalledWith(expect.stringContaining('Running npm install'));
    });

    it('should leave an existing .npmrc untouched when the install fails', async () => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/install-fail-test`,
        '1.0.0',
        PackageManager.Npm
      );

      // Create existing .npmrc file to verify it is never written to
      const npmrcPath = path.join(packagePath, '.npmrc');
      const originalContent = 'registry=https://registry.npmjs.org/';
      await fs.writeFile(npmrcPath, originalContent);

      // Use a non-existent registry to force failure
      const badRegistryUrl = 'http://localhost:9999';

      try {
        await PackageManagerService.runInstallWithRegistry(
          packagePath,
          await LocalPackageStoreService.getStore(),
          badRegistryUrl
        );
      } catch {
        // Expected to fail
      }

      expect(await fs.readFile(npmrcPath, 'utf8')).toBe(originalContent);
      expect(await fs.pathExists(`${npmrcPath}.tmp`)).toBe(false);
    });

    it('should auto-detect package manager from project', async () => {
      // Create a pnpm project
      const pnpmPath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/auto-detect-pnpm`,
        '1.0.0',
        PackageManager.Pnpm
      );

      // Spy on detectPackageManager to verify it was called
      const detectSpy = vi.spyOn(PackageManagerService, 'detectPackageManager');

      try {
        await PackageManagerService.runInstallWithRegistry(
          pnpmPath,
          await LocalPackageStoreService.getStore()
        );
      } catch {
        // May fail due to missing dependencies, but that's OK for this test
      }

      // Verify detectPackageManager was called with the correct path
      expect(detectSpy).toHaveBeenCalledWith(pnpmPath);

      detectSpy.mockRestore();
    });

    /**
     * Helper function to test successful install with a specific package manager.
     *
     * The subscriber points its own scope at the public registry, so the install
     * only resolves the published package if the command line override outranks
     * the project's own configuration.
     *
     * @param packageManager The package manager to test
     * @param expectedLogMessage The expected log message to verify
     */
    const testInstallWithPackageManager = async (
      packageManager: PackageManager,
      expectedLogMessage: string
    ) => {
      const packageManagerName = packageManager.toLowerCase();
      const publisherName = `@test-${testId}/${packageManagerName}-install-publisher`;

      // Create a publisher package and a subscriber bound to it
      const { publisherPath, subscriberPath } = await TestProjectUtils.createSubscribedProjects(
        publisherName,
        `@test-${testId}/${packageManagerName}-install-subscriber`,
        packageManager
      );

      TestProjectUtils.changeToProject(publisherPath);
      await VerdaccioService.publishPackage(publisherPath);

      const npmrcContent = `@test-${testId}:registry=https://registry.npmjs.org/\n`;
      await TestProjectUtils.createNpmrcFile(subscriberPath, npmrcContent);

      // Run install with registry
      await PackageManagerService.runInstallWithRegistry(
        subscriberPath,
        await LocalPackageStoreService.getStore()
      );

      // Verify install succeeded by checking that the lock file has content
      const lockFilePath = path.join(subscriberPath, PACKAGE_MANAGER_INFO[packageManager].lockFile);
      expect(await fs.pathExists(lockFilePath)).toBe(true);

      const lockFileContent = await fs.readFile(lockFilePath, 'utf8');
      expect(lockFileContent.trim().length).toBeGreaterThan(0);
      expect(lockFileContent).toContain(publisherName);

      // Verify the project's own configuration was left alone
      const npmrcPath = path.join(subscriberPath, '.npmrc');
      expect(await fs.readFile(npmrcPath, 'utf8')).toBe(npmrcContent);
      expect(await fs.pathExists(`${npmrcPath}.tmp`)).toBe(false);

      // Verify package manager was detected correctly
      expect(DR.logger.info).toHaveBeenCalledWith(expect.stringContaining(expectedLogMessage));
    };
  });
});
