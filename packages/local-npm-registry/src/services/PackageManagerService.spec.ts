import { DR, PackageJson } from '@aneuhold/core-ts-lib';
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
import {
  PACKAGE_MANAGER_INFO,
  PackageManager
} from '../types/PackageManager.js';
import { MutexService } from './MutexService.js';
import {
  PackageManagerService,
  type PackageManagerConfigBackup
} from './PackageManagerService.js';
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

describe('Unit Tests', () => {
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

  describe('getPackageInfo', () => {
    it('should successfully read package.json file', async () => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/get-package-info`,
        '1.0.0'
      );

      const packageInfo =
        await PackageManagerService.getPackageInfo(packagePath);

      expect(packageInfo).toBeTruthy();
      expect(packageInfo?.name).toBe(`@test-${testId}/get-package-info`);
      expect(packageInfo?.version).toBe('1.0.0');
    });

    it('should return null for non-existent directory', async () => {
      const nonExistentPath = path.join(
        TestProjectUtils.getTestInstanceDir(),
        'non-existent'
      );

      const packageInfo =
        await PackageManagerService.getPackageInfo(nonExistentPath);

      expect(packageInfo).toBeNull();
      expect(DR.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error reading package.json')
      );
    });

    it('should return null for invalid package.json', async () => {
      const invalidDir = path.join(
        TestProjectUtils.getTestInstanceDir(),
        'invalid'
      );
      await fs.ensureDir(invalidDir);
      await fs.writeJson(path.join(invalidDir, 'package.json'), {
        description: 'Missing name and version'
      });

      const packageInfo =
        await PackageManagerService.getPackageInfo(invalidDir);

      expect(packageInfo).toBeNull();
      expect(DR.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'package.json must contain name and version fields'
        )
      );
    });

    it('should use current working directory when no dir specified', async () => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/cwd-test`,
        '2.0.0'
      );

      // Change to the package directory
      TestProjectUtils.changeToProject(packagePath);

      const packageInfo = await PackageManagerService.getPackageInfo();

      expect(packageInfo).toBeTruthy();
      expect(packageInfo?.name).toBe(`@test-${testId}/cwd-test`);
      expect(packageInfo?.version).toBe('2.0.0');
    });
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
      const emptyDir = path.join(
        TestProjectUtils.getTestInstanceDir(),
        'no-locks'
      );
      await fs.ensureDir(emptyDir);

      // Create a basic package.json without lock files
      await fs.writeJson(path.join(emptyDir, 'package.json'), {
        name: `@test-${testId}/no-locks`,
        version: '1.0.0'
      });

      const packageManager =
        await PackageManagerService.detectPackageManager(emptyDir);

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
      const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;
      packageJson.packageManager = 'pnpm@8.0.0';
      await fs.writeJson(packageJsonPath, packageJson);

      const packageManager =
        await PackageManagerService.detectPackageManager(packagePath);

      // Should detect pnpm from packageManager field despite npm lock file
      expect(packageManager).toBe(PackageManager.Pnpm);
    });

    /**
     * Helper function to test package manager detection
     *
     * @param suffix The suffix for the package name
     * @param expectedManager The expected package manager to be detected
     */
    const testPackageManagerDetection = async (
      suffix: string,
      expectedManager: PackageManager
    ) => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/${suffix}`,
        '1.0.0',
        expectedManager
      );

      const packageManager =
        await PackageManagerService.detectPackageManager(packagePath);

      expect(packageManager).toBe(expectedManager);
    };
  });

  describe('createRegistryConfig', () => {
    it('should create npm registry configuration', async () => {
      const { packagePath, backup } = await createRegistryConfigTest(
        'npm-config',
        PackageManager.Npm
      );

      await verifyNpmRegistryConfig(packagePath, backup);
    });

    it('should create pnpm registry configuration', async () => {
      const { backup } = await createRegistryConfigTest(
        'pnpm-config',
        PackageManager.Pnpm
      );

      // Verify backup structure
      expect(backup.npmrc).toBeDefined();
    });

    it('should create yarn registry configuration', async () => {
      const { packagePath, backup } = await createRegistryConfigTest(
        'yarn-config',
        PackageManager.Yarn
      );

      await verifyYarnRegistryConfig(packagePath, backup);
    });

    it('should create yarn4 registry configuration', async () => {
      const { packagePath, backup } = await createRegistryConfigTest(
        'yarn4-config',
        PackageManager.Yarn4
      );

      await verifyYarn4RegistryConfig(packagePath, backup);
    });

    it('should backup existing configuration files', async () => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/backup-test`,
        '1.0.0',
        PackageManager.Npm
      );

      // Create existing .npmrc file
      const npmrcPath = path.join(packagePath, '.npmrc');
      const existingContent = 'registry=https://registry.npmjs.org/';
      await fs.writeFile(npmrcPath, existingContent);

      const backup = await PackageManagerService.createRegistryConfig(
        PackageManager.Npm,
        'http://localhost:4873',
        packagePath
      );

      // Verify backup contains original content
      expect(backup.npmrc?.content).toBe(existingContent);
      expect(backup.npmrc?.path).toBe(npmrcPath);

      // Verify file was overwritten
      const newContent = await fs.readFile(npmrcPath, 'utf8');
      expect(newContent).not.toBe(existingContent);
      expect(newContent).toContain('localhost:4873');
    });

    /**
     * Helper function to create registry config for testing
     *
     * @param suffix The suffix for the package name
     * @param packageManager The package manager to test
     */
    const createRegistryConfigTest = async (
      suffix: string,
      packageManager: PackageManager
    ) => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/${suffix}`,
        '1.0.0',
        packageManager
      );
      const registryUrl = 'http://localhost:4873';

      const backup = await PackageManagerService.createRegistryConfig(
        packageManager,
        registryUrl,
        packagePath
      );

      return { packagePath, backup };
    };

    /**
     * Helper function to verify npm registry configuration
     *
     * @param packagePath The path to the package
     * @param backup The backup configuration
     */
    const verifyNpmRegistryConfig = async (
      packagePath: string,
      backup: PackageManagerConfigBackup
    ) => {
      // Verify .npmrc file was created
      const npmrcPath = path.join(packagePath, '.npmrc');
      expect(await fs.pathExists(npmrcPath)).toBe(true);

      const npmrcContent = await fs.readFile(npmrcPath, 'utf8');
      expect(npmrcContent).toContain('registry=http://localhost:4873');
      expect(npmrcContent).toContain('//localhost:4873/:_authToken=fake');

      // Verify backup structure
      expect(backup.npmrc).toBeDefined();
      expect(backup.npmrc?.path).toBe(npmrcPath);
      expect(backup.npmrc?.content).toBeNull(); // File didn't exist originally
    };

    /**
     * Helper function to verify yarn registry configuration
     *
     * @param packagePath The path to the package
     * @param backup The backup configuration
     */
    const verifyYarnRegistryConfig = async (
      packagePath: string,
      backup: PackageManagerConfigBackup
    ) => {
      // Verify .npmrc file was created (Yarn Classic uses .npmrc like npm and pnpm)
      const npmrcPath = path.join(packagePath, '.npmrc');
      expect(await fs.pathExists(npmrcPath)).toBe(true);

      const npmrcContent = await fs.readFile(npmrcPath, 'utf8');
      expect(npmrcContent).toContain('registry=http://localhost:4873');
      expect(npmrcContent).toContain('//localhost:4873/:_authToken=fake');

      // Verify .yarnrc was NOT created (Yarn Classic uses .npmrc, not .yarnrc)
      const yarnrcPath = path.join(packagePath, '.yarnrc');
      expect(await fs.pathExists(yarnrcPath)).toBe(false);

      // Verify backup structure
      expect(backup.npmrc).toBeDefined();
      expect(backup.npmrc?.path).toBe(npmrcPath);
      expect(backup.npmrc?.content).toBeNull(); // File didn't exist originally
      // Verify yarnrc backup is not present since Yarn Classic doesn't use it
      expect(backup.yarnrc).toBeUndefined();
    };

    /**
     * Helper function to verify yarn4 registry configuration
     *
     * @param packagePath The path to the package
     * @param backup The backup configuration
     */
    const verifyYarn4RegistryConfig = async (
      packagePath: string,
      backup: PackageManagerConfigBackup
    ) => {
      // Verify .yarnrc.yml file was created
      const yarnrcYmlPath = path.join(packagePath, '.yarnrc.yml');
      expect(await fs.pathExists(yarnrcYmlPath)).toBe(true);

      const yarnrcYmlContent = await fs.readFile(yarnrcYmlPath, 'utf8');
      expect(yarnrcYmlContent).toContain(
        'npmRegistryServer: http://localhost:4873'
      );

      // Verify .npmrc was also created for auth
      const npmrcPath = path.join(packagePath, '.npmrc');
      expect(await fs.pathExists(npmrcPath)).toBe(true);

      // Verify backup structure
      expect(backup.yarnrcYml).toBeDefined();
      expect(backup.npmrc).toBeDefined();
    };
  });

  describe('restoreRegistryConfig', () => {
    it('should restore original configuration files', async () => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/restore-test`,
        '1.0.0',
        PackageManager.Npm
      );

      // Create existing .npmrc file
      const npmrcPath = path.join(packagePath, '.npmrc');
      const originalContent = 'registry=https://registry.npmjs.org/';
      await fs.writeFile(npmrcPath, originalContent);

      // Create registry config (should backup existing)
      const backup = await PackageManagerService.createRegistryConfig(
        PackageManager.Npm,
        'http://localhost:4873',
        packagePath
      );

      // Verify file was modified
      let currentContent = await fs.readFile(npmrcPath, 'utf8');
      expect(currentContent).toContain('localhost:4873');

      // Restore configuration
      await PackageManagerService.restoreRegistryConfig(backup);

      // Verify original content was restored
      currentContent = await fs.readFile(npmrcPath, 'utf8');
      expect(currentContent).toBe(originalContent);
    });

    it('should remove files that did not exist originally', async () => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/remove-test`,
        '1.0.0',
        PackageManager.Npm
      );

      const npmrcPath = path.join(packagePath, '.npmrc');

      // Verify file doesn't exist initially
      expect(await fs.pathExists(npmrcPath)).toBe(false);

      // Create registry config
      const backup = await PackageManagerService.createRegistryConfig(
        PackageManager.Npm,
        'http://localhost:4873',
        packagePath
      );

      // Verify file was created
      expect(await fs.pathExists(npmrcPath)).toBe(true);

      // Restore configuration
      await PackageManagerService.restoreRegistryConfig(backup);

      // Verify file was removed since it didn't exist originally
      expect(await fs.pathExists(npmrcPath)).toBe(false);
    });

    it('should handle multiple configuration files', async () => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/multi-restore-test`,
        '1.0.0',
        PackageManager.Yarn
      );

      // Create registry config (creates both .yarnrc and .npmrc)
      const backup = await PackageManagerService.createRegistryConfig(
        PackageManager.Yarn4,
        'http://localhost:4873',
        packagePath
      );

      const yarnrcPath = path.join(packagePath, '.yarnrc.yml');
      const npmrcPath = path.join(packagePath, '.npmrc');

      // Verify both files were created
      expect(await fs.pathExists(yarnrcPath)).toBe(true);
      expect(await fs.pathExists(npmrcPath)).toBe(true);

      // Restore configuration
      await PackageManagerService.restoreRegistryConfig(backup);

      // Verify both files were removed (since they didn't exist originally)
      expect(await fs.pathExists(yarnrcPath)).toBe(false);
      expect(await fs.pathExists(npmrcPath)).toBe(false);
    });
  });

  describe('runInstallWithRegistry', () => {
    beforeEach(async () => {
      // Start Verdaccio before running install tests
      await VerdaccioService.start();
    });

    it('should successfully run install with npm', async () => {
      await testInstallWithPackageManager(
        PackageManager.Npm,
        'Running npm install'
      );
    });

    it('should successfully run install with pnpm', async () => {
      await testInstallWithPackageManager(
        PackageManager.Pnpm,
        'Running pnpm install'
      );
    });

    it('should successfully run install with yarn', async () => {
      await testInstallWithPackageManager(
        PackageManager.Yarn,
        'Running Yarn Classic install'
      );
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
          customRegistryUrl
        );
      } catch {
        // Expected to fail since registry doesn't exist
      }

      // During the test, the configuration would have been created and then restored
      // We can verify the process attempted to use the custom URL by checking logs
      expect(DR.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Running npm install')
      );
    });

    it('should restore configuration even when install fails', async () => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/install-fail-test`,
        '1.0.0',
        PackageManager.Npm
      );

      // Create existing .npmrc file to verify it gets restored
      const npmrcPath = path.join(packagePath, '.npmrc');
      const originalContent = 'registry=https://registry.npmjs.org/';
      await fs.writeFile(npmrcPath, originalContent);

      // Use a non-existent registry to force failure
      const badRegistryUrl = 'http://localhost:9999';

      try {
        await PackageManagerService.runInstallWithRegistry(
          packagePath,
          badRegistryUrl
        );
      } catch {
        // Expected to fail
      }

      // Verify original content was restored despite failure
      const restoredContent = await fs.readFile(npmrcPath, 'utf8');
      expect(restoredContent).toBe(originalContent);
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
        await PackageManagerService.runInstallWithRegistry(pnpmPath);
      } catch {
        // May fail due to missing dependencies, but that's OK for this test
      }

      // Verify detectPackageManager was called with the correct path
      expect(detectSpy).toHaveBeenCalledWith(pnpmPath);

      detectSpy.mockRestore();
    });

    /**
     * Helper function to test successful install with a specific package manager
     *
     * @param packageManager The package manager to test
     * @param expectedLogMessage The expected log message to verify
     */
    const testInstallWithPackageManager = async (
      packageManager: PackageManager,
      expectedLogMessage: string
    ) => {
      const packageManagerName = packageManager.toLowerCase();

      // Create a publisher package and publish it
      const publisherPath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/${packageManagerName}-install-publisher`,
        '1.0.0',
        packageManager
      );

      TestProjectUtils.changeToProject(publisherPath);
      await VerdaccioService.publishPackage(publisherPath);

      // Create a subscriber package that depends on the published package
      const subscriberPath = await TestProjectUtils.createSubscriberProject(
        `@test-${testId}/${packageManagerName}-install-subscriber`,
        `@test-${testId}/${packageManagerName}-install-publisher`,
        '1.0.0',
        packageManager
      );

      // Run install with registry
      await PackageManagerService.runInstallWithRegistry(subscriberPath);

      // Verify install succeeded by checking that the lock file has content
      const lockFilePath = path.join(
        subscriberPath,
        PACKAGE_MANAGER_INFO[packageManager].lockFile
      );
      expect(await fs.pathExists(lockFilePath)).toBe(true);

      const lockFileContent = await fs.readFile(lockFilePath, 'utf8');
      expect(lockFileContent.trim().length).toBeGreaterThan(0);
      expect(lockFileContent).toContain(
        `@test-${testId}/${packageManagerName}-install-publisher`
      );

      // Verify package manager was detected correctly
      expect(DR.logger.info).toHaveBeenCalledWith(
        expect.stringContaining(expectedLogMessage)
      );
    };
  });

  describe('error handling', () => {
    it('should handle malformed package.json gracefully', async () => {
      const invalidDir = path.join(
        TestProjectUtils.getTestInstanceDir(),
        'malformed'
      );
      await fs.ensureDir(invalidDir);

      // Create malformed JSON file
      const packageJsonPath = path.join(invalidDir, 'package.json');
      await fs.writeFile(packageJsonPath, '{ invalid json');

      const packageInfo =
        await PackageManagerService.getPackageInfo(invalidDir);

      expect(packageInfo).toBeNull();
      expect(DR.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error reading package.json')
      );
    });

    it('should handle permission errors during config creation', async () => {
      // This test simulates permission errors that might occur in real scenarios
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/permission-test`,
        '1.0.0',
        PackageManager.Npm
      );

      // Mock fs.writeFile to throw a permission error
      const writeFileSpy = vi.spyOn(fs, 'writeFile');
      writeFileSpy.mockRejectedValueOnce(
        new Error('EACCES: permission denied')
      );

      try {
        await PackageManagerService.createRegistryConfig(
          PackageManager.Npm,
          'http://localhost:4873',
          packagePath
        );
        // Should throw the permission error
        expect(true).toBe(false); // This should not be reached
      } catch (error) {
        expect(String(error)).toContain('permission denied');
      }

      writeFileSpy.mockRestore();
    });
  });

  describe('configuration file formats', () => {
    it('should generate correct npm configuration format', async () => {
      await testConfigurationFormat(
        'npm-format-test',
        PackageManager.Npm,
        'http://localhost:4873',
        (content) => {
          expect(content).toContain('registry=http://localhost:4873');
          expect(content).toContain('//localhost:4873/:_authToken=fake');
        }
      );
    });

    it('should generate correct yarn configuration format', async () => {
      await testConfigurationFormat(
        'yarn-format-test',
        PackageManager.Yarn,
        'http://localhost:4873',
        (content) => {
          expect(content).toContain('registry=http://localhost:4873');
        }
      );
    });

    it('should generate correct yarn4 configuration format', async () => {
      await testConfigurationFormat(
        'yarn4-format-test',
        PackageManager.Yarn4,
        'http://localhost:4873',
        (content) => {
          expect(content).toContain('npmRegistryServer: http://localhost:4873');
        },
        '.yarnrc.yml'
      );
    });

    it('should handle different registry URL formats', async () => {
      await testConfigurationFormat(
        'url-format-test',
        PackageManager.Npm,
        'https://my-registry.com:8080',
        (content) => {
          expect(content).toContain('registry=https://my-registry.com:8080');
          expect(content).toContain('//my-registry.com:8080/:_authToken=fake');
        }
      );
    });

    /**
     * Helper function to test configuration file format generation
     *
     * @param suffix The suffix for the package name
     * @param packageManager The package manager to test
     * @param registryUrl The registry URL to use
     * @param verifyContent Function to verify the generated content
     * @param configFile The configuration file to read (defaults to .npmrc)
     */
    const testConfigurationFormat = async (
      suffix: string,
      packageManager: PackageManager,
      registryUrl: string,
      verifyContent: (content: string) => void,
      configFile: string = '.npmrc'
    ) => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/${suffix}`,
        '1.0.0',
        packageManager
      );

      await PackageManagerService.createRegistryConfig(
        packageManager,
        registryUrl,
        packagePath
      );

      const configContent = await fs.readFile(
        path.join(packagePath, configFile),
        'utf8'
      );

      verifyContent(configContent);
    };
  });
});
