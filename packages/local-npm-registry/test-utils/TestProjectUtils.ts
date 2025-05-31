import { PackageJson } from '@aneuhold/core-ts-lib';
import { execa } from 'execa';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

export type PackageManager = 'npm' | 'yarn' | 'pnpm';

/**
 * Test utilities for creating temporary test projects
 */
export class TestProjectUtils {
  private static tempDir: string;
  private static originalCwd: string;

  /**
   * Creates a temporary directory for test projects
   */
  static async setupTempDir(): Promise<string> {
    TestProjectUtils.originalCwd = process.cwd();
    TestProjectUtils.tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'local-npm-registry-test-')
    );
    return TestProjectUtils.tempDir;
  }

  /**
   * Cleans up the temporary directory
   */
  static async cleanupTempDir(): Promise<void> {
    if (TestProjectUtils.tempDir) {
      await fs.remove(TestProjectUtils.tempDir);
    }
    if (TestProjectUtils.originalCwd) {
      process.chdir(TestProjectUtils.originalCwd);
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
    const packageDir = path.join(
      TestProjectUtils.tempDir,
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
}
