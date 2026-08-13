import { isPackageJson, type PackageJson } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { PublishCommand } from '../src/commands/PublishCommand.js';
import { SubscribeCommand } from '../src/commands/SubscribeCommand.js';
import { ConfigService } from '../src/services/Config.service.js';
import { LocalPackageStoreService } from '../src/services/LocalPackageStore.service.js';
import { LocalPackageVersionService } from '../src/services/LocalPackageVersion.service.js';
import { MutexService } from '../src/services/Mutex.service.js';
import { VerdaccioService } from '../src/services/Verdaccio.service.js';
import type { LocalPackageStore } from '../src/types/LocalPackageStore.js';
import { PACKAGE_MANAGER_INFO, PackageManager } from '../src/types/PackageManager.js';
import { VERDACCIO_DB_FILE_NAME, isVerdaccioDb } from '../src/types/VerdaccioDb.js';

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
  static #globalTempDir: string;
  static #originalCwd: string;
  static #testInstanceDir: string;
  static #testConfigFilePath: string | null = null;

  /**
   * Sets up the global tmp directory (called once before all test files)
   */
  static async setupGlobalTempDir(): Promise<void> {
    if (!TestProjectUtils.#originalCwd) {
      TestProjectUtils.#originalCwd = process.cwd();
    }

    // Create tmp directory with random GUID in the local-npm-registry package folder
    const packageRoot = path.dirname(__dirname);
    const tmpDirName = `tmp-${randomUUID()}`;
    TestProjectUtils.#globalTempDir = path.join(packageRoot, tmpDirName);

    // Clean and recreate the tmp directory
    await fs.remove(TestProjectUtils.#globalTempDir);
    await fs.ensureDir(TestProjectUtils.#globalTempDir);

    await TestProjectUtils.#setupTestConfig();
  }

  /**
   * Cleans up the global tmp directory (called once after all tests in a test file)
   */
  static async cleanupGlobalTempDir(): Promise<void> {
    // Clean up test configuration first, which is what restores the original
    // working directory
    await TestProjectUtils.#cleanupTestConfig();

    if (TestProjectUtils.#globalTempDir) {
      await fs.remove(TestProjectUtils.#globalTempDir);
    }
  }

  /**
   * Creates a unique test instance directory for each test
   */
  static async setupTestInstance(): Promise<string> {
    if (!TestProjectUtils.#globalTempDir) {
      throw new Error('Global temp directory not initialized. Call setupGlobalTempDir() first.');
    }

    // Clear configuration cache to ensure test isolation
    ConfigService.clearCache();

    // Work from the tmp directory so the test configuration is the one that is
    // found, which keeps the store and Verdaccio data out of the real data directory
    process.chdir(TestProjectUtils.#globalTempDir);

    // Create a unique directory for this test instance using a GUID
    const testId = randomUUID();
    TestProjectUtils.#testInstanceDir = path.join(TestProjectUtils.#globalTempDir, testId);
    await fs.ensureDir(TestProjectUtils.#testInstanceDir);

    return TestProjectUtils.#testInstanceDir;
  }

  /**
   * Cleans up the test instance directory
   */
  static async cleanupTestInstance(): Promise<void> {
    // Clear configuration cache to ensure test isolation
    ConfigService.clearCache();

    // Restore original working directory
    if (TestProjectUtils.#originalCwd) {
      process.chdir(TestProjectUtils.#originalCwd);
    }

    // Remove the test instance directory
    if (TestProjectUtils.#testInstanceDir) {
      await fs.remove(TestProjectUtils.#testInstanceDir);
    }
  }

  /**
   * Creates a test package project with package.json and an empty lock file
   *
   * @param name - Package name
   * @param version - Package version
   * @param packageManager - Package manager to use
   * @param dependencies - Optional dependencies to include
   * @param directoryName - Name of the directory to create the package in, which two publishing directories of one package name need to keep apart
   */
  static async createTestPackage(
    name: string,
    version = '1.0.0',
    packageManager: PackageManager = PackageManager.Npm,
    dependencies: Record<string, string> = {},
    directoryName: string = name.replace('@', '').replace('/', '-')
  ): Promise<string> {
    if (!TestProjectUtils.#testInstanceDir) {
      throw new Error('Test instance directory not initialized. Call setupTestInstance() first.');
    }

    const packageDir = path.join(TestProjectUtils.#testInstanceDir, directoryName);
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

    await TestProjectUtils.#createEmptyLockFile(packageDir, packageManager);

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
   * Creates a publisher package and a subscriber project bound to it in the local
   * package store, without publishing anything to the registry.
   *
   * @param packageName - Name of the package the subscriber depends on
   * @param subscriberName - Name of the subscribing project
   * @param packageManager - Package manager both projects use
   * @param version - Version the package is registered under
   */
  static async createSubscribedProjects(
    packageName: string,
    subscriberName: string,
    packageManager: PackageManager = PackageManager.Npm,
    version = '1.0.0'
  ): Promise<{ publisherPath: string; subscriberPath: string }> {
    const { publisherPath, subscriberPath } = await TestProjectUtils.#createPublisherAndSubscriber(
      packageName,
      subscriberName,
      packageManager,
      version
    );

    await TestProjectUtils.mutateStore((store) => {
      LocalPackageStoreService.updatePackageEntry(store, packageName, publisherPath, {
        originalVersion: version,
        currentVersion: version,
        subscribers: [{ subscriberPath, originalSpecifier: version }]
      });
    });

    return { publisherPath, subscriberPath };
  }

  /**
   * Creates a publisher package and a subscriber project, then binds them by
   * running the real publish and subscribe commands.
   *
   * @param packageName - Name of the package to publish
   * @param subscriberName - Name of the subscribing project
   * @param packageManager - Package manager both projects use
   * @param version - Version the package starts at
   */
  static async publishAndSubscribe(
    packageName: string,
    subscriberName: string,
    packageManager: PackageManager = PackageManager.Npm,
    version = '1.0.0'
  ): Promise<{ publisherPath: string; subscriberPath: string }> {
    const { publisherPath, subscriberPath } = await TestProjectUtils.#createPublisherAndSubscriber(
      packageName,
      subscriberName,
      packageManager,
      version
    );

    TestProjectUtils.changeToProject(publisherPath);
    await PublishCommand.execute();

    TestProjectUtils.changeToProject(subscriberPath);
    await SubscribeCommand.execute(packageName);

    return { publisherPath, subscriberPath };
  }

  /**
   * Creates two copies of one package name in separate directories and
   * publishes from both, which is what puts one package in the store under two
   * publishing directories.
   *
   * @param packageName - Name of the package both directories hold
   * @param version - Version both directories start at
   * @param packageManager - Package manager both directories use
   */
  static async publishFromTwoDirectories(
    packageName: string,
    version = '1.0.0',
    packageManager: PackageManager = PackageManager.Npm
  ): Promise<{ firstPublisherPath: string; secondPublisherPath: string }> {
    const publisherPaths: string[] = [];

    for (const directoryName of ['first-publisher', 'second-publisher']) {
      const publisherPath = await TestProjectUtils.createTestPackage(
        packageName,
        version,
        packageManager,
        {},
        directoryName
      );

      TestProjectUtils.changeToProject(publisherPath);
      await PublishCommand.execute();

      publisherPaths.push(publisherPath);
    }

    return { firstPublisherPath: publisherPaths[0], secondPublisherPath: publisherPaths[1] };
  }

  /**
   * Applies a mutation to the local package store under the store lock, so test
   * setup reads and writes the store the way the commands do.
   *
   * @param mutator - Applies the change to the store that is about to be written
   */
  static async mutateStore(mutator: (store: LocalPackageStore) => void): Promise<void> {
    await MutexService.withLock(async () => {
      const store = await LocalPackageStoreService.getStore();
      mutator(store);
      await LocalPackageStoreService.writeStore(store);
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
    const raw: unknown = await fs.readJson(path.join(projectPath, 'package.json'));
    if (!isPackageJson(raw)) {
      throw new Error(`package.json at ${projectPath} did not match PackageJson shape`);
    }
    return raw;
  }

  /**
   * Adds a dependency to a project after it was created, for a subscriber that
   * can only declare its second local package once the first one resolves.
   *
   * @param projectPath - Path to the project directory
   * @param packageName - Name of the dependency to add
   * @param specifier - Specifier to declare it with
   */
  static async addDependencyToProject(
    projectPath: string,
    packageName: string,
    specifier: string
  ): Promise<void> {
    const packageJson = await TestProjectUtils.readPackageJson(projectPath);
    packageJson.dependencies = { ...packageJson.dependencies, [packageName]: specifier };

    await fs.writeJson(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 });
  }

  /**
   * Reads the package.json of a dependency as it was installed into a project,
   * which is what the project actually resolves rather than what it asks for.
   *
   * @param projectPath - Path to the project directory
   * @param packageName - Name of the installed dependency
   */
  static async readInstalledPackageJson(
    projectPath: string,
    packageName: string
  ): Promise<PackageJson> {
    return TestProjectUtils.readPackageJson(
      path.join(projectPath, 'node_modules', ...packageName.split('/'))
    );
  }

  /**
   * Builds the pattern a version published from a directory matches, so a test
   * can assert that a specifier was moved onto the local registry's version of
   * an original version without naming the timestamp it landed on.
   *
   * @param originalVersion - The version the local one is built from
   * @param packagePath - The directory the package is published from
   */
  static getLocalVersionPattern(originalVersion: string, packagePath: string): RegExp {
    return new RegExp(
      `^${originalVersion.replace(/\./g, '\\.')}${LocalPackageVersionService.getSuffixRegex(packagePath).source}$`
    );
  }

  /**
   * The directory the local registry keeps a package's tarballs and metadata in
   *
   * @param packageName - The package to locate
   */
  static getRegistryPackageStorage(packageName: string): string {
    return path.join(VerdaccioService.verdaccioConfig.storage, ...packageName.split('/'));
  }

  /**
   * The file name the local registry stores a version of a package under
   *
   * @param packageName - The package the tarball holds
   * @param version - The version the tarball holds
   */
  static getRegistryTarballName(packageName: string, version: string): string {
    return `${packageName.split('/').pop() ?? packageName}-${version}.tgz`;
  }

  /**
   * Reads the names of the packages the local registry holds itself rather than
   * proxies, which is what its database records.
   */
  static async getRegistryDbPackageNames(): Promise<string[]> {
    const dbContent: unknown = await fs.readJson(
      path.join(VerdaccioService.verdaccioConfig.storage, VERDACCIO_DB_FILE_NAME)
    );
    if (!isVerdaccioDb(dbContent)) {
      throw new Error('The local registry database is not in the expected format');
    }
    return dbContent.list;
  }

  /**
   * Gets the current test instance directory
   */
  static getTestInstanceDir(): string {
    if (!TestProjectUtils.#testInstanceDir) {
      throw new Error('Test instance directory not initialized. Call setupTestInstance() first.');
    }
    return TestProjectUtils.#testInstanceDir;
  }

  /**
   * Gets the lock file path for a package manager in a project directory
   *
   * @param projectPath - Path to the project directory
   * @param packageManager - Package manager to get lock file for
   */
  static getLockFilePath(projectPath: string, packageManager: PackageManager): string {
    return path.join(projectPath, PACKAGE_MANAGER_INFO[packageManager].lockFile);
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

    const structure = await TestProjectUtils.#createMultiLayerNpmrcStructure(
      testInstanceDir,
      layers
    );

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

  /**
   * Sets up a test-specific configuration file that points to the tmp directory
   * for the store location to prevent pollution of the global store file.
   */
  static async #setupTestConfig(): Promise<void> {
    if (!TestProjectUtils.#globalTempDir) {
      throw new Error('Global temp directory must be set up first');
    }

    // Clear any cached configuration to ensure we use the test config
    ConfigService.clearCache();

    // Create test configuration file in the tmp directory
    TestProjectUtils.#testConfigFilePath = await ConfigService.createDefaultConfig(
      TestProjectUtils.#globalTempDir
    );

    // Change working directory to the tmp directory so the config is found
    process.chdir(TestProjectUtils.#globalTempDir);
  }

  /**
   * Clears the test configuration and restores the original working directory
   */
  static async #cleanupTestConfig(): Promise<void> {
    // Clear the configuration cache to prevent test pollution
    ConfigService.clearCache();

    // Restore original working directory
    if (TestProjectUtils.#originalCwd) {
      process.chdir(TestProjectUtils.#originalCwd);
    }

    // Clean up the test config file
    if (TestProjectUtils.#testConfigFilePath) {
      try {
        await fs.remove(TestProjectUtils.#testConfigFilePath);
      } catch {
        // Ignore errors during cleanup
      }
      TestProjectUtils.#testConfigFilePath = null;
    }
  }

  /**
   * Creates the publisher package and the subscriber project a binding is made
   * between, leaving how they are bound to the caller.
   *
   * @param packageName - Name of the package the subscriber depends on
   * @param subscriberName - Name of the subscribing project
   * @param packageManager - Package manager both projects use
   * @param version - Version the package starts at
   */
  static async #createPublisherAndSubscriber(
    packageName: string,
    subscriberName: string,
    packageManager: PackageManager,
    version: string
  ): Promise<{ publisherPath: string; subscriberPath: string }> {
    const publisherPath = await TestProjectUtils.createTestPackage(
      packageName,
      version,
      packageManager
    );
    const subscriberPath = await TestProjectUtils.createSubscriberProject(
      subscriberName,
      packageName,
      version,
      packageManager
    );

    return { publisherPath, subscriberPath };
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
  static async #createEmptyLockFile(
    projectPath: string,
    packageManager: PackageManager
  ): Promise<void> {
    // An npm lock file has to parse as JSON, where the others are read as text
    await fs.writeFile(
      TestProjectUtils.getLockFilePath(projectPath, packageManager),
      packageManager === PackageManager.Npm ? '{}' : ''
    );

    if (packageManager === PackageManager.Pnpm) {
      await fs.writeFile(path.join(projectPath, 'pnpm-workspace.yaml'), '');
    }
  }

  /**
   * Creates a multi-layer directory structure with .npmrc files for testing
   * npmrc parsing up the directory tree.
   *
   * @param baseDir - Base directory to create the structure in
   * @param layers - Array of objects describing each layer with directory name and npmrc content
   * @returns Object with paths to created directories and npmrc files
   */
  static async #createMultiLayerNpmrcStructure(
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
      const npmrcPath = await TestProjectUtils.createNpmrcFile(currentPath, layer.npmrcContent);
      npmrcFiles.push(npmrcPath);
    }

    return {
      directories,
      npmrcFiles,
      deepestDir: currentPath
    };
  }
}
