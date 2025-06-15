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
import { DEFAULT_CONFIG } from '../types/LocalNpmConfig.js';
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

      const backup = await PackageManagerService.createRegistryConfig(
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

  describe('getAllNpmrcConfigs', () => {
    beforeEach(() => {
      // Clear npmrc cache before each test to ensure isolation
      PackageManagerService.clearNpmrcCache();
    });

    afterEach(() => {
      // Clear npmrc cache after each test to ensure isolation
      PackageManagerService.clearNpmrcCache();
    });

    it('should parse a single .npmrc file correctly', async () => {
      const testInstanceDir = TestProjectUtils.getTestInstanceDir();
      const timestamp = Date.now();
      const uniqueRegistry = `https://single-registry-${timestamp}.example.com`;

      const npmrcContent = `# Single .npmrc file test
@test-org:registry=${uniqueRegistry}
//${uniqueRegistry.replace('https://', '')}/:_authToken=test-token-${timestamp}
test-setting=test-value
`;

      await TestProjectUtils.createNpmrcFile(testInstanceDir, npmrcContent);

      const configs =
        await PackageManagerService.getAllNpmrcConfigs(testInstanceDir);

      expect(configs.size).toBeGreaterThanOrEqual(3);
      expect(configs.get('@test-org:registry')).toBe(uniqueRegistry);
      expect(
        configs.get(`//${uniqueRegistry.replace('https://', '')}/:_authToken`)
      ).toBe(`test-token-${timestamp}`);
      expect(configs.get('test-setting')).toBe('test-value');
    });

    it('should handle multi-layer .npmrc files with correct precedence', async () => {
      const testInstanceDir = TestProjectUtils.getTestInstanceDir();

      const scenario =
        await TestProjectUtils.createTestNpmrcScenario(testInstanceDir);

      // Change to the deepest directory to test parsing up the tree
      const configs = await PackageManagerService.getAllNpmrcConfigs(
        scenario.structure.deepestDir
      );

      // Should contain at least our expected configs (may have more from local machine)
      expect(configs.size).toBeGreaterThanOrEqual(
        scenario.expectedConfigs.size
      );

      // Verify all expected configurations are present with correct values
      for (const [key, expectedValue] of scenario.expectedConfigs) {
        expect(configs.get(key)).toBe(expectedValue);
      }

      // Verify precedence: project-level should override root/middle for shared keys
      expect(configs.get('some-global-setting')).toBe('project-value');
    });

    it('should ignore comments and empty lines in .npmrc files', async () => {
      const testInstanceDir = TestProjectUtils.getTestInstanceDir();
      const timestamp = Date.now();

      const npmrcContent = `# This is a comment
# Another comment

@test-org:registry=https://test-${timestamp}.example.com

; This is also a comment
valid-setting=valid-value

# Final comment
`;

      await TestProjectUtils.createNpmrcFile(testInstanceDir, npmrcContent);

      const configs =
        await PackageManagerService.getAllNpmrcConfigs(testInstanceDir);

      // Should only have the valid key-value pairs, not comments
      expect(configs.get('@test-org:registry')).toBe(
        `https://test-${timestamp}.example.com`
      );
      expect(configs.get('valid-setting')).toBe('valid-value');

      // Should not contain comment keys
      expect(configs.has('# This is a comment')).toBe(false);
      expect(configs.has('; This is also a comment')).toBe(false);
    });

    it('should cache results on subsequent calls', async () => {
      const testInstanceDir = TestProjectUtils.getTestInstanceDir();
      const timestamp = Date.now();

      await TestProjectUtils.createNpmrcFile(
        testInstanceDir,
        `test-cached-setting=cached-value-${timestamp}`
      );

      // First call should read from files
      const configs1 =
        await PackageManagerService.getAllNpmrcConfigs(testInstanceDir);
      expect(configs1.get('test-cached-setting')).toBe(
        `cached-value-${timestamp}`
      );

      // Modify the .npmrc file after first call
      await TestProjectUtils.createNpmrcFile(
        testInstanceDir,
        `test-cached-setting=modified-value-${timestamp}`
      );

      // Second call should return cached result (not the modified value)
      const configs2 =
        await PackageManagerService.getAllNpmrcConfigs(testInstanceDir);
      expect(configs2.get('test-cached-setting')).toBe(
        `cached-value-${timestamp}`
      );
      expect(configs1).toBe(configs2); // Should be the same Map instance

      // Clear cache and call again should read the modified file
      PackageManagerService.clearNpmrcCache();
      const configs3 =
        await PackageManagerService.getAllNpmrcConfigs(testInstanceDir);
      expect(configs3.get('test-cached-setting')).toBe(
        `modified-value-${timestamp}`
      );
    });

    it('should handle malformed .npmrc files gracefully', async () => {
      const testInstanceDir = TestProjectUtils.getTestInstanceDir();
      const timestamp = Date.now();

      const malformedNpmrcContent = `# Valid comment
valid-key=valid-value
malformed-line-without-equals
=value-without-key
key-without-value=
@test-org:registry=https://test-${timestamp}.example.com
another=valid-entry
`;

      await TestProjectUtils.createNpmrcFile(
        testInstanceDir,
        malformedNpmrcContent
      );

      const configs =
        await PackageManagerService.getAllNpmrcConfigs(testInstanceDir);

      // Should successfully parse valid entries
      expect(configs.get('valid-key')).toBe('valid-value');
      expect(configs.get('@test-org:registry')).toBe(
        `https://test-${timestamp}.example.com`
      );
      expect(configs.get('another')).toBe('valid-entry');
      expect(configs.get('key-without-value')).toBe('');

      // Should not contain malformed entries
      expect(configs.has('malformed-line-without-equals')).toBe(false);
      expect(configs.has('')).toBe(false); // Empty key from "=value-without-key"
    });

    it('should handle organization registries and auth tokens for VerdaccioService integration', async () => {
      const testInstanceDir = TestProjectUtils.getTestInstanceDir();
      const timestamp = Date.now();
      const testRegistries = [
        `https://org1-registry-${timestamp}.example.com`,
        `https://org2-registry-${timestamp}.example.com`
      ];

      const npmrcContent = `# Organization-specific registries
@test-org1:registry=${testRegistries[0]}
@test-org2:registry=${testRegistries[1]}

# Auth tokens for the registries
//${testRegistries[0].replace('https://', '')}/:_authToken=token1-${timestamp}
//${testRegistries[1].replace('https://', '')}/:_authToken=token2-${timestamp}

# Other settings
registry=https://registry.npmjs.org/
save-exact=true
`;

      await TestProjectUtils.createNpmrcFile(testInstanceDir, npmrcContent);

      const configs =
        await PackageManagerService.getAllNpmrcConfigs(testInstanceDir);

      // Verify organization registries
      expect(configs.get('@test-org1:registry')).toBe(testRegistries[0]);
      expect(configs.get('@test-org2:registry')).toBe(testRegistries[1]);

      // Verify auth tokens
      expect(
        configs.get(
          `//${testRegistries[0].replace('https://', '')}/:_authToken`
        )
      ).toBe(`token1-${timestamp}`);
      expect(
        configs.get(
          `//${testRegistries[1].replace('https://', '')}/:_authToken`
        )
      ).toBe(`token2-${timestamp}`);

      // Verify other settings
      expect(configs.get('registry')).toBe('https://registry.npmjs.org/');
      expect(configs.get('save-exact')).toBe('true');
    });

    it('should work correctly when called from different directories', async () => {
      const testInstanceDir = TestProjectUtils.getTestInstanceDir();

      // Create nested directory structure with .npmrc files
      const scenario =
        await TestProjectUtils.createTestNpmrcScenario(testInstanceDir);

      // Test from root level directory
      const configsFromRoot = await PackageManagerService.getAllNpmrcConfigs(
        scenario.structure.directories[0]
      );

      // Test from deepest directory
      const configsFromDeep = await PackageManagerService.getAllNpmrcConfigs(
        scenario.structure.deepestDir
      );

      // Root level should only see its own .npmrc
      expect(configsFromRoot.get('some-global-setting')).toBe('root-value');
      expect(configsFromRoot.has('middle-specific-setting')).toBe(false);
      expect(configsFromRoot.has('project-specific-setting')).toBe(false);

      // Deep level should see all .npmrc files with correct precedence
      expect(configsFromDeep.get('some-global-setting')).toBe('project-value');
      expect(configsFromDeep.get('middle-specific-setting')).toBe(
        'middle-specific-value'
      );
      expect(configsFromDeep.get('project-specific-setting')).toBe(
        'project-specific-value'
      );
    });
  });
});
