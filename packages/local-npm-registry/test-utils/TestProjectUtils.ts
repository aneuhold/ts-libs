import { PackageJson } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { expect } from 'vitest';
import { ConfigService } from '../src/services/ConfigService.js';
import {
  LocalPackageStoreService,
  type PackageEntry
} from '../src/services/LocalPackageStoreService.js';
import { PACKAGE_MANAGER_INFO, PackageManager } from '../src/types/PackageManager.js';

/**
 * Test utilities for creating temporary test projects with isolated configurations.
 *
 * This class manages a hierarchical test directory structure that ensures complete
 * isolation between test runs and prevents pollution of global configuration files.
 *
 * ### Test Directory Structure
 *
 * When tests run, the following directory hierarchy is created:
 *
 * ```txt
 * local-npm-registry/
 * └── tmp/                                    (Global temp directory)
 *     └── {test-instance-uuid}/              (Unique directory per test)
 *         └── [test packages created by individual tests]
 * ```
 */
export class TestProjectUtils {
  private static globalTempDir: string;
  private static originalCwd: string;
  private static testInstanceDir: string;
  private static testConfigFilePath: string | null = null;

  /**
   * Sets up the global tmp directory (called once before all test files)
   */
  static async setupGlobalTempDir(): Promise<void> {
    if (!TestProjectUtils.originalCwd) {
      TestProjectUtils.originalCwd = process.cwd();
    }

    // Create tmp directory with random GUID in the local-npm-registry package folder
    const packageRoot = path.dirname(__dirname);
    const tmpDirName = `tmp-${randomUUID()}`;
    TestProjectUtils.globalTempDir = path.join(packageRoot, tmpDirName);

    // Clean and recreate the tmp directory
    await fs.remove(TestProjectUtils.globalTempDir);
    await fs.ensureDir(TestProjectUtils.globalTempDir);

    // Create test configuration file in the tmp directory
    await TestProjectUtils.setupTestConfig();
  }

  /**
   * Sets up a test-specific configuration file that points to the tmp directory
   * for the store location to prevent pollution of the global store file.
   */
  static async setupTestConfig(): Promise<void> {
    if (!TestProjectUtils.globalTempDir) {
      throw new Error('Global temp directory must be set up first');
    }

    // Clear any cached configuration to ensure we use the test config
    ConfigService.clearCache();

    // Create test configuration file in the tmp directory
    TestProjectUtils.testConfigFilePath = await ConfigService.createDefaultConfig(
      TestProjectUtils.globalTempDir
    );

    // Change working directory to the tmp directory so the config is found
    process.chdir(TestProjectUtils.globalTempDir);
  }

  /**
   * Cleans up the global tmp directory (called once after all tests in a test file)
   */
  static async cleanupGlobalTempDir(): Promise<void> {
    // Clean up test configuration first
    await TestProjectUtils.cleanupTestConfig();

    if (TestProjectUtils.globalTempDir) {
      await fs.remove(TestProjectUtils.globalTempDir);
    }
    if (TestProjectUtils.originalCwd) {
      process.chdir(TestProjectUtils.originalCwd);
    }
  }

  /**
   * Clears the test configuration and restores the original working directory
   */
  static async cleanupTestConfig(): Promise<void> {
    // Clear the configuration cache to prevent test pollution
    ConfigService.clearCache();

    // Restore original working directory
    if (TestProjectUtils.originalCwd) {
      process.chdir(TestProjectUtils.originalCwd);
    }

    // Clean up the test config file
    if (TestProjectUtils.testConfigFilePath) {
      try {
        await fs.remove(TestProjectUtils.testConfigFilePath);
      } catch {
        // Ignore errors during cleanup
      }
      TestProjectUtils.testConfigFilePath = null;
    }
  }

  /**
   * Creates a unique test instance directory for each test
   */
  static async setupTestInstance(): Promise<string> {
    if (!TestProjectUtils.globalTempDir) {
      throw new Error('Global temp directory not initialized. Call setupGlobalTempDir() first.');
    }

    // Clear configuration cache to ensure test isolation
    ConfigService.clearCache();

    // Create a unique directory for this test instance using a GUID
    const testId = randomUUID();
    TestProjectUtils.testInstanceDir = path.join(TestProjectUtils.globalTempDir, testId);
    await fs.ensureDir(TestProjectUtils.testInstanceDir);

    return TestProjectUtils.testInstanceDir;
  }

  /**
   * Cleans up the test instance directory
   */
  static async cleanupTestInstance(): Promise<void> {
    // Clear configuration cache to ensure test isolation
    ConfigService.clearCache();

    // Restore original working directory
    if (TestProjectUtils.originalCwd) {
      process.chdir(TestProjectUtils.originalCwd);
    }

    // Remove the test instance directory
    if (TestProjectUtils.testInstanceDir) {
      await fs.remove(TestProjectUtils.testInstanceDir);
    }
  }

  /**
   * Creates a test package project with package.json and runs install to generate lock files
   *
   * @param name - Package name
   * @param version - Package version
   * @param packageManager - Package manager to use
   * @param dependencies - Optional dependencies to include
   */
  static async createTestPackage(
    name: string,
    version = '1.0.0',
    packageManager: PackageManager = PackageManager.Npm,
    dependencies: Record<string, string> = {}
  ): Promise<string> {
    if (!TestProjectUtils.testInstanceDir) {
      throw new Error('Test instance directory not initialized. Call setupTestInstance() first.');
    }

    const packageDir = path.join(
      TestProjectUtils.testInstanceDir,
      name.replace('@', '').replace('/', '-')
    );
    await fs.ensureDir(packageDir);

    // Create package.json
    const packageJson = {
      name,
      version,
      description: `Test package ${name}`,
      main: 'index.js',
      dependencies,
      scripts: {
        test: 'echo "Test script"'
      },
      ...(packageManager === PackageManager.Yarn4 && {
        packageManager: 'yarn@4.6.0'
      }),
      ...(packageManager === PackageManager.Yarn && {
        packageManager: 'yarn@1.22.22'
      })
    };

    await fs.writeJson(path.join(packageDir, 'package.json'), packageJson, {
      spaces: 2
    });

    // Create a simple index.js file
    await fs.writeFile(
      path.join(packageDir, 'index.js'),
      `// Test package ${name}\nmodule.exports = { name: '${name}', version: '${version}' };\n`
    );

    // Create empty lock file for the package manager instead of running install
    await TestProjectUtils.createEmptyLockFile(packageDir, packageManager);

    return packageDir;
  }

  /**
   * Creates a subscriber project that depends on another package
   *
   * @param name - Subscriber project name
   * @param dependencyName - Name of the package to depend on
   * @param dependencyVersion - Version of the dependency
   * @param packageManager - Package manager to use
   */
  static async createSubscriberProject(
    name: string,
    dependencyName: string,
    dependencyVersion = '1.0.0',
    packageManager: PackageManager = PackageManager.Npm
  ): Promise<string> {
    return TestProjectUtils.createTestPackage(name, '1.0.0', packageManager, {
      [dependencyName]: dependencyVersion
    });
  }

  /**
   * Creates an empty lock file for the specified package manager.
   * This simulates the initial state without running actual install commands.
   *
   * For pnpm projects, this also creates an empty pnpm-workspace.yaml file.
   *
   * Actual install commands cannot be run because the test packages are not
   * actually published to NPM.
   *
   * @param projectPath - Path to the project directory
   * @param packageManager - Package manager to use
   */
  static async createEmptyLockFile(
    projectPath: string,
    packageManager: PackageManager
  ): Promise<void> {
    const lockFileName = PACKAGE_MANAGER_INFO[packageManager].lockFile;
    const lockFilePath = path.join(projectPath, lockFileName);

    switch (packageManager) {
      case PackageManager.Npm:
        await fs.writeFile(lockFilePath, '{}');
        break;
      case PackageManager.Pnpm: {
        await fs.writeFile(lockFilePath, '');
        // Create empty pnpm-workspace.yaml file for pnpm projects
        const workspaceFilePath = path.join(projectPath, 'pnpm-workspace.yaml');
        await fs.writeFile(workspaceFilePath, '');
        break;
      }
      case PackageManager.Yarn:
      case PackageManager.Yarn4:
        await fs.writeFile(lockFilePath, '');
        break;
    }
  }

  /**
   * Changes the current working directory to the specified path
   *
   * @param projectPath - Path to change to
   */
  static changeToProject(projectPath: string): void {
    process.chdir(projectPath);
  }

  /**
   * Reads the package.json from a project directory
   *
   * @param projectPath - Path to the project directory
   */
  static async readPackageJson(projectPath: string): Promise<PackageJson> {
    return (await fs.readJson(path.join(projectPath, 'package.json'))) as PackageJson;
  }

  /**
   * Gets a package entry from the local package store
   *
   * @param packageName - Name of the package to retrieve
   */
  static async getPackageEntry(packageName: string): Promise<PackageEntry | null> {
    return LocalPackageStoreService.getPackageEntry(packageName);
  }

  /**
   * Gets the current test instance directory
   */
  static getTestInstanceDir(): string {
    if (!TestProjectUtils.testInstanceDir) {
      throw new Error('Test instance directory not initialized. Call setupTestInstance() first.');
    }
    return TestProjectUtils.testInstanceDir;
  }

  /**
   * Gets the lock file path for a package manager in a project directory
   *
   * @param projectPath - Path to the project directory
   * @param packageManager - Package manager to get lock file for
   */
  static getLockFilePath(projectPath: string, packageManager: PackageManager): string {
    const lockFileName = PACKAGE_MANAGER_INFO[packageManager].lockFile;
    return path.join(projectPath, lockFileName);
  }

  /**
   * Checks if a project has a non-empty lock file for the specified package manager
   *
   * @param projectPath - Path to the project directory
   * @param packageManager - Package manager to check lock file for
   */
  static async hasNonEmptyLockFile(
    projectPath: string,
    packageManager: PackageManager
  ): Promise<boolean> {
    const lockFilePath = TestProjectUtils.getLockFilePath(projectPath, packageManager);

    try {
      const stats = await fs.stat(lockFilePath);
      if (!stats.isFile()) {
        return false;
      }

      // Check if file has content beyond empty/minimal placeholder
      const content = await fs.readFile(lockFilePath, 'utf8');

      switch (packageManager) {
        case PackageManager.Npm:
          // npm lock files should have more than just "{}"
          return content.trim() !== '{}' && content.trim().length > 2;
        case PackageManager.Pnpm:
        case PackageManager.Yarn:
        case PackageManager.Yarn4:
          // yarn and pnpm lock files should not be empty
          return content.trim().length > 0;
        default:
          return false;
      }
    } catch {
      // File doesn't exist or can't be read
      return false;
    }
  }

  /**
   * Validates that subscriber projects have non-empty lock files
   *
   * @param subscriberPaths - Array of paths to subscriber projects
   * @param packageManager - Package manager to check lock files for
   */
  static async validateSubscriberLockFiles(
    subscriberPaths: string[],
    packageManager: PackageManager
  ): Promise<void> {
    for (const subscriberPath of subscriberPaths) {
      const hasLockFile = await TestProjectUtils.hasNonEmptyLockFile(
        subscriberPath,
        packageManager
      );
      expect(hasLockFile).toBe(true);
    }
  }

  /**
   * Creates a .npmrc file with the specified content in a directory
   *
   * @param directoryPath - Path to the directory where .npmrc should be created
   * @param npmrcContent - Content to write to the .npmrc file
   */
  static async createNpmrcFile(directoryPath: string, npmrcContent: string): Promise<string> {
    await fs.ensureDir(directoryPath);
    const npmrcPath = path.join(directoryPath, '.npmrc');
    await fs.writeFile(npmrcPath, npmrcContent);
    return npmrcPath;
  }

  /**
   * Creates a multi-layer directory structure with .npmrc files for testing
   * npmrc parsing up the directory tree.
   *
   * @param baseDir - Base directory to create the structure in
   * @param layers - Array of objects describing each layer with directory name and npmrc content
   * @returns Object with paths to created directories and npmrc files
   */
  static async createMultiLayerNpmrcStructure(
    baseDir: string,
    layers: Array<{ dirName: string; npmrcContent: string }>
  ): Promise<{
    directories: string[];
    npmrcFiles: string[];
    deepestDir: string;
  }> {
    const directories: string[] = [];
    const npmrcFiles: string[] = [];
    let currentPath = baseDir;

    for (const layer of layers) {
      currentPath = path.join(currentPath, layer.dirName);
      directories.push(currentPath);

      await fs.ensureDir(currentPath);
      const npmrcPath = await this.createNpmrcFile(currentPath, layer.npmrcContent);
      npmrcFiles.push(npmrcPath);
    }

    return {
      directories,
      npmrcFiles,
      deepestDir: currentPath
    };
  }

  /**
   * Creates a test scenario with .npmrc files at different levels with unique
   * test registries to avoid conflicts with any existing local .npmrc files.
   *
   * @param testInstanceDir - The test instance directory to create structure in
   * @returns Object with created structure information and expected parsed values
   */
  static async createTestNpmrcScenario(testInstanceDir: string): Promise<{
    structure: {
      directories: string[];
      npmrcFiles: string[];
      deepestDir: string;
    };
    expectedConfigs: Map<string, string>;
    uniqueRegistries: string[];
  }> {
    const timestamp = Date.now();
    const uniqueRegistries = [
      `https://test-registry-${timestamp}-1.example.com`,
      `https://test-registry-${timestamp}-2.example.com`,
      `https://test-registry-${timestamp}-3.example.com`
    ];

    const layers = [
      {
        dirName: 'root-level',
        npmrcContent: `# Root level .npmrc
@test-org1:registry=${uniqueRegistries[0]}
//${uniqueRegistries[0].replace('https://', '')}/:_authToken=root-auth-token-${timestamp}
some-global-setting=root-value
`
      },
      {
        dirName: 'middle-level',
        npmrcContent: `# Middle level .npmrc
@test-org2:registry=${uniqueRegistries[1]}
//${uniqueRegistries[1].replace('https://', '')}/:_authToken=middle-auth-token-${timestamp}
some-global-setting=middle-value
middle-specific-setting=middle-specific-value
`
      },
      {
        dirName: 'project-level',
        npmrcContent: `# Project level .npmrc (closest)
@test-org3:registry=${uniqueRegistries[2]}
//${uniqueRegistries[2].replace('https://', '')}/:_authToken=project-auth-token-${timestamp}
some-global-setting=project-value
project-specific-setting=project-specific-value
`
      }
    ];

    const structure = await this.createMultiLayerNpmrcStructure(testInstanceDir, layers);

    // Expected configurations with closest files taking precedence
    const expectedConfigs = new Map<string, string>([
      // Organization registries from all levels
      ['@test-org1:registry', uniqueRegistries[0]],
      ['@test-org2:registry', uniqueRegistries[1]],
      ['@test-org3:registry', uniqueRegistries[2]],
      // Auth tokens from all levels
      [
        `//${uniqueRegistries[0].replace('https://', '')}/:_authToken`,
        `root-auth-token-${timestamp}`
      ],
      [
        `//${uniqueRegistries[1].replace('https://', '')}/:_authToken`,
        `middle-auth-token-${timestamp}`
      ],
      [
        `//${uniqueRegistries[2].replace('https://', '')}/:_authToken`,
        `project-auth-token-${timestamp}`
      ],
      // Settings with project level taking precedence
      ['some-global-setting', 'project-value'], // Project level wins
      ['middle-specific-setting', 'middle-specific-value'],
      ['project-specific-setting', 'project-specific-value']
    ]);

    return {
      structure,
      expectedConfigs,
      uniqueRegistries
    };
  }
}
