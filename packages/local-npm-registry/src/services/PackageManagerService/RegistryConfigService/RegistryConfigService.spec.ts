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
import { TestProjectUtils } from '../../../../test-utils/TestProjectUtils.js';
import { DEFAULT_CONFIG } from '../../../types/LocalNpmConfig.js';
import { PackageManager } from '../../../types/PackageManager.js';
import { MutexService } from '../../MutexService.js';
import { VerdaccioService } from '../../VerdaccioService.js';
import {
  RegistryConfigService,
  type PackageManagerConfigBackup
} from './RegistryConfigService.js';

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

      const backup = await RegistryConfigService.createRegistryConfig(
        PackageManager.Npm,
        DEFAULT_CONFIG.registryUrl,
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

    it('should override organization prefix registry in existing .npmrc', async () => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/org-prefix-override`,
        '1.0.0',
        PackageManager.Npm
      );

      // Create existing .npmrc file with organization prefix registry
      const npmrcPath = path.join(packagePath, '.npmrc');
      const existingContent = `registry=https://registry.npmjs.org/
@test-${testId}:registry=https://custom-org-registry.com/
@myorg:registry=https://another-custom-registry.com/`;
      await fs.writeFile(npmrcPath, existingContent);

      const backup = await RegistryConfigService.createRegistryConfig(
        PackageManager.Npm,
        DEFAULT_CONFIG.registryUrl,
        packagePath
      );

      // Verify backup contains original content
      expect(backup.npmrc?.content).toBe(existingContent);
      expect(backup.npmrc?.path).toBe(npmrcPath);

      // Verify file was overwritten with local registry configuration
      const newContent = await fs.readFile(npmrcPath, 'utf8');
      expect(newContent).not.toBe(existingContent);
      expect(newContent).toContain('localhost:4873');

      // Verify that the organization prefix for the test package is now pointing to local registry
      expect(newContent).toContain(
        `@test-${testId}:registry=http://localhost:4873`
      );

      // Verify that other organization prefixes are also redirected to local registry
      expect(newContent).toContain('@myorg:registry=http://localhost:4873');

      // Verify that the original organization registry URLs are no longer present
      expect(newContent).not.toContain(
        `@test-${testId}:registry=https://custom-org-registry.com/`
      );
      expect(newContent).not.toContain(
        '@myorg:registry=https://another-custom-registry.com/'
      );
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
      const registryUrl = DEFAULT_CONFIG.registryUrl;

      const backup = await RegistryConfigService.createRegistryConfig(
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

      // Verify backup structure
      expect(backup.yarnrcYml).toBeDefined();
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
      const backup = await RegistryConfigService.createRegistryConfig(
        PackageManager.Npm,
        'http://localhost:4873',
        packagePath
      );

      // Verify file was modified
      let currentContent = await fs.readFile(npmrcPath, 'utf8');
      expect(currentContent).toContain('localhost:4873');

      // Restore configuration
      await RegistryConfigService.restoreRegistryConfig(backup);

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
      const backup = await RegistryConfigService.createRegistryConfig(
        PackageManager.Npm,
        'http://localhost:4873',
        packagePath
      );

      // Verify file was created
      expect(await fs.pathExists(npmrcPath)).toBe(true);

      // Restore configuration
      await RegistryConfigService.restoreRegistryConfig(backup);

      // Verify file was removed since it didn't exist originally
      expect(await fs.pathExists(npmrcPath)).toBe(false);
    });
  });

  describe('error handling', () => {
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
        await RegistryConfigService.createRegistryConfig(
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

      await RegistryConfigService.createRegistryConfig(
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
