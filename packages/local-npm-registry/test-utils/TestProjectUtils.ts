import { PackageJson } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { PACKAGE_MANAGER_INFO } from '../lib/types/PackageManager.js';
import { ConfigService } from '../src/services/ConfigService.js';
import {
  LocalPackageStoreService,
  type PackageEntry
} from '../src/services/LocalPackageStoreService.js';
import { PackageManager } from '../src/types/PackageManager.js';

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
 *     ├── .local-npm-registry.json           (Test-specific config file)
 *     ├── .local-package-store.json          (Isolated package store)
 *     ├── verdaccio-storage/                  (Verdaccio package storage)
 *     │   └── [packages published during tests]
 *     ├── verdaccio-self/                     (Verdaccio internal files)
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
   * Sets up the global tmp directory (called once before all tests)
   */
  static async setupGlobalTempDir(): Promise<void> {
    if (!TestProjectUtils.originalCwd) {
      TestProjectUtils.originalCwd = process.cwd();
    }

    // Create tmp directory in the local-npm-registry package folder
    const packageRoot = path.dirname(__dirname);
    TestProjectUtils.globalTempDir = path.join(packageRoot, 'tmp');

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
    TestProjectUtils.testConfigFilePath =
      await ConfigService.createDefaultConfig(TestProjectUtils.globalTempDir);

    // Change working directory to the tmp directory so the config is found
    process.chdir(TestProjectUtils.globalTempDir);
  }

  /**
   * Cleans up the global tmp directory (called once after all tests)
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
      throw new Error(
        'Global temp directory not initialized. Call setupGlobalTempDir() first.'
      );
    }

    // Clear configuration cache to ensure test isolation
    ConfigService.clearCache();

    // Create a unique directory for this test instance using a GUID
    const testId = randomUUID();
    TestProjectUtils.testInstanceDir = path.join(
      TestProjectUtils.globalTempDir,
      testId
    );
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
      throw new Error(
        'Test instance directory not initialized. Call setupTestInstance() first.'
      );
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

    // Run install command to generate lock files naturally
    await TestProjectUtils.runInstallCommand(packageDir, packageManager);

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
   * Runs the appropriate install command for the given package manager
   *
   * @param projectPath - Path to the project directory
   * @param packageManager - Package manager to use
   */
  static async runInstallCommand(
    projectPath: string,
    packageManager: PackageManager
  ): Promise<void> {
    // For yarn4, we use the 'yarn' command since the version is specified in package.json
    const installCommand = PACKAGE_MANAGER_INFO[packageManager].command;
    const args = ['install'];

    await execa(installCommand, args, {
      cwd: projectPath
    });
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
    return (await fs.readJson(
      path.join(projectPath, 'package.json')
    )) as PackageJson;
  }

  /**
   * Gets a package entry from the local package store
   *
   * @param packageName - Name of the package to retrieve
   */
  static async getPackageEntry(
    packageName: string
  ): Promise<PackageEntry | null> {
    return LocalPackageStoreService.getPackageEntry(packageName);
  }

  /**
   * Gets the current test instance directory
   */
  static getTestInstanceDir(): string {
    if (!TestProjectUtils.testInstanceDir) {
      throw new Error(
        'Test instance directory not initialized. Call setupTestInstance() first.'
      );
    }
    return TestProjectUtils.testInstanceDir;
  }
}
