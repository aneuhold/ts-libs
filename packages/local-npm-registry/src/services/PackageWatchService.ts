import { DR } from '@aneuhold/core-ts-lib';
import { FSWatcher, watch } from 'chokidar';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import type { PublishedPackageInfo } from '../types/WatchConfig.js';
import { ConfigService } from './ConfigService.js';
import { LocalPackageStoreService } from './LocalPackageStoreService.js';
import { VerdaccioService } from './VerdaccioService.js';

/**
 * Service to watch packages for changes and handle local publishing.
 */
export class PackageWatchService {
  private watchers: Map<string, FSWatcher> = new Map();
  private buildTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private verdaccioService = VerdaccioService.getInstance();

  /**
   * Starts watching the specified packages for changes.
   *
   * @param packageNames - Array of package names to watch. If empty, watches all packages in the monorepo.
   */
  async startWatching(packageNames: string[] = []): Promise<void> {
    const config = await ConfigService.loadConfig();
    const workspaceRoot = await this.findWorkspaceRoot();

    if (!workspaceRoot) {
      throw new Error(
        'Could not find workspace root (no pnpm-workspace.yaml found)'
      );
    }

    const packagesToWatch =
      packageNames.length > 0
        ? packageNames
        : await this.findAllPackages(workspaceRoot);

    DR.logger.info(`Starting to watch ${packagesToWatch.length} packages...`);

    // Ensure Verdaccio is running if auto-start is enabled
    if (config.watch?.autoStartRegistry !== false) {
      await this.verdaccioService.start();
    }

    for (const packageName of packagesToWatch) {
      await this.watchPackage(packageName, workspaceRoot);
    }

    DR.logger.info('All packages are now being watched for changes');
  }

  /**
   * Stops watching all packages.
   */
  async stopWatching(): Promise<void> {
    DR.logger.info('Stopping all watchers...');

    // Clear any pending build timeouts
    for (const timeout of this.buildTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.buildTimeouts.clear();

    // Close all watchers
    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }
    this.watchers.clear();

    DR.logger.info('All watchers stopped');
  }

  /**
   * Manually triggers a build and publish for a specific package.
   *
   * @param packageName - Name of the package to build and publish
   */
  async buildAndPublishPackage(
    packageName: string
  ): Promise<PublishedPackageInfo | null> {
    const workspaceRoot = await this.findWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error('Could not find workspace root');
    }

    const packagePath = await this.findPackagePath(packageName, workspaceRoot);
    if (!packagePath) {
      throw new Error(`Package ${packageName} not found`);
    }

    return this.performBuildAndPublish(packagePath, packageName);
  }

  /**
   * Finds the workspace root by looking for pnpm-workspace.yaml.
   */
  private async findWorkspaceRoot(): Promise<string | null> {
    let currentDir = process.cwd();

    while (currentDir !== path.dirname(currentDir)) {
      const workspaceFile = path.join(currentDir, 'pnpm-workspace.yaml');
      if (await fs.pathExists(workspaceFile)) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  /**
   * Finds all packages in the workspace.
   *
   * @param workspaceRoot
   */
  private async findAllPackages(workspaceRoot: string): Promise<string[]> {
    const packagesDir = path.join(workspaceRoot, 'packages');

    if (!(await fs.pathExists(packagesDir))) {
      return [];
    }

    const packageNames: string[] = [];
    const entries = await fs.readdir(packagesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const packageJsonPath = path.join(
          packagesDir,
          entry.name,
          'package.json'
        );
        if (await fs.pathExists(packageJsonPath)) {
          try {
            const packageJson = await fs.readJson(packageJsonPath);
            if (packageJson.name) {
              packageNames.push(packageJson.name);
            }
          } catch (error) {
            DR.logger.warn(
              `Failed to read package.json for ${entry.name}: ${String(error)}`
            );
          }
        }
      }
    }

    return packageNames;
  }

  /**
   * Finds the path to a specific package.
   *
   * @param packageName
   * @param workspaceRoot
   */
  private async findPackagePath(
    packageName: string,
    workspaceRoot: string
  ): Promise<string | null> {
    const packagesDir = path.join(workspaceRoot, 'packages');
    const entries = await fs.readdir(packagesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const packagePath = path.join(packagesDir, entry.name);
        const packageJsonPath = path.join(packagePath, 'package.json');

        if (await fs.pathExists(packageJsonPath)) {
          try {
            const packageJson = await fs.readJson(packageJsonPath);
            if (packageJson.name === packageName) {
              return packagePath;
            }
          } catch (error) {
            // Continue searching
          }
        }
      }
    }

    return null;
  }

  /**
   * Sets up watching for a specific package.
   *
   * @param packageName
   * @param workspaceRoot
   */
  private async watchPackage(
    packageName: string,
    workspaceRoot: string
  ): Promise<void> {
    const packagePath = await this.findPackagePath(packageName, workspaceRoot);

    if (!packagePath) {
      DR.logger.warn(`Package ${packageName} not found, skipping watch setup`);
      return;
    }

    // Watch source files (src directory and package.json)
    const watchPaths = [
      path.join(packagePath, 'src/**/*'),
      path.join(packagePath, 'package.json'),
      path.join(packagePath, 'tsconfig*.json')
    ];

    const watcher = watch(watchPaths, {
      ignored: [
        '**/node_modules/**',
        '**/lib/**',
        '**/*.d.ts.map',
        '**/*.js.map'
      ],
      ignoreInitial: true,
      persistent: true
    });

    watcher.on('change', (filePath) => {
      DR.logger.info(
        `File changed in ${packageName}: ${path.relative(packagePath, filePath)}`
      );
      this.scheduleRebuild(packageName, packagePath);
    });

    watcher.on('add', (filePath) => {
      DR.logger.info(
        `File added in ${packageName}: ${path.relative(packagePath, filePath)}`
      );
      this.scheduleRebuild(packageName, packagePath);
    });

    watcher.on('unlink', (filePath) => {
      DR.logger.info(
        `File removed in ${packageName}: ${path.relative(packagePath, filePath)}`
      );
      this.scheduleRebuild(packageName, packagePath);
    });

    watcher.on('error', (error) => {
      DR.logger.error(`Watcher error for ${packageName}: ${String(error)}`);
    });

    this.watchers.set(packageName, watcher);
    DR.logger.info(`Started watching ${packageName} at ${packagePath}`);
  }

  /**
   * Schedules a rebuild with debouncing to avoid too frequent rebuilds.
   *
   * @param packageName
   * @param packagePath
   */
  private scheduleRebuild(packageName: string, packagePath: string): void {
    // Clear existing timeout if any
    const existingTimeout = this.buildTimeouts.get(packageName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new build after a short delay (debouncing)
    const timeout = setTimeout(async () => {
      this.buildTimeouts.delete(packageName);
      await this.performBuildAndPublish(packagePath, packageName);
    }, 1000); // 1 second debounce

    this.buildTimeouts.set(packageName, timeout);
  }

  /**
   * Performs the actual build and publish process.
   *
   * @param packagePath
   * @param packageName
   */
  private async performBuildAndPublish(
    packagePath: string,
    packageName: string
  ): Promise<PublishedPackageInfo | null> {
    try {
      DR.logger.info(`Building ${packageName}...`);

      // Run the build command
      await execa('pnpm', ['build'], {
        cwd: packagePath,
        stdio: 'pipe'
      });

      DR.logger.info(`Build completed for ${packageName}`);

      // Read package.json to get current version
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageJson = await fs.readJson(packageJsonPath);
      const baseVersion = packageJson.version;

      // Create a timestamped version for local publishing
      const timestamp = Date.now();
      const localVersion = `${baseVersion}-local.${timestamp}`;

      // Temporarily update package.json with the local version
      const originalPackageJson = { ...packageJson };
      packageJson.version = localVersion;
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

      try {
        // Publish to local registry
        await this.verdaccioService.publishPackage(packagePath);

        // Update the local package store
        await LocalPackageStoreService.updatePackageVersion(
          packageName,
          localVersion
        );

        const publishedInfo: PublishedPackageInfo = {
          name: packageName,
          version: localVersion,
          publishedAt: new Date(),
          buildPath: packagePath
        };

        DR.logger.info(
          `Successfully published ${packageName}@${localVersion} to local registry`
        );
        return publishedInfo;
      } finally {
        // Restore original package.json
        await fs.writeJson(packageJsonPath, originalPackageJson, { spaces: 2 });
      }
    } catch (error) {
      DR.logger.error(
        `Failed to build and publish ${packageName}: ${String(error)}`
      );
      return null;
    }
  }
}
