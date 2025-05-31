import { PackageJson } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import {
  LocalPackageStoreService,
  type PackageEntry
} from '../src/services/LocalPackageStoreService.js';

export type PackageManager = 'npm' | 'yarn' | 'pnpm';

/**
 * Test utilities for creating temporary test projects
 */
export class TestProjectUtils {
  private static globalTempDir: string;
  private static originalCwd: string;
  private static testInstanceDir: string;

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
  }

  /**
   * Cleans up the global tmp directory (called once after all tests)
   */
  static async cleanupGlobalTempDir(): Promise<void> {
    if (TestProjectUtils.globalTempDir) {
      await fs.remove(TestProjectUtils.globalTempDir);
    }
    if (TestProjectUtils.originalCwd) {
      process.chdir(TestProjectUtils.originalCwd);
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
    packageManager: PackageManager = 'npm',
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
      }
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
    if (Object.keys(dependencies).length > 0) {
      await TestProjectUtils.runInstallCommand(packageDir, packageManager);
    }

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
    packageManager: PackageManager = 'npm'
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
    const installCommand = packageManager === 'yarn' ? 'yarn' : packageManager;
    const args = packageManager === 'yarn' ? ['install'] : ['install'];

    try {
      await execa(installCommand, args, {
        cwd: projectPath,
        stdio: 'pipe' // Suppress output during tests
      });
    } catch {
      // Ignore install errors in tests - some dependencies might not be available
      // but we still want to test the core functionality
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
