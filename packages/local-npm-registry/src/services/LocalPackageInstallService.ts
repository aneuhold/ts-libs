import { DR, PackageJson } from '@aneuhold/core-ts-lib';
import { FSWatcher, watch } from 'chokidar';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { ConfigService } from './ConfigService.js';
import { LocalPackageStoreService } from './LocalPackageStoreService.js';

/**
 * Service to manage local package installations and updates in consuming projects.
 */
export class LocalPackageInstallService {
  private storeWatcher: FSWatcher | null = null;
  private watchedPackages: Set<string> = new Set();

  /**
   * Installs a local package in the current project and sets up watching for updates.
   *
   * @param packageName - Name of the package to install locally
   */
  async installLocalPackage(packageName: string): Promise<void> {
    const config = await ConfigService.loadConfig();
    const registryUrl = config.watch?.registryUrl || 'http://localhost:4873';

    try {
      // Get the latest version from the local store
      const store = await LocalPackageStoreService.getStore();
      const packageEntry = store.packages[packageName];

      if (!packageEntry) {
        throw new Error(
          `Package ${packageName} not found in local store. Make sure it's being watched and published.`
        );
      }

      DR.logger.info(
        `Installing ${packageName}@${packageEntry.currentVersion} from local registry...`
      );

      // Install the specific version from the local registry
      await execa(
        'npm',
        [
          'install',
          `${packageName}@${packageEntry.currentVersion}`,
          '--registry',
          registryUrl
        ],
        {
          stdio: 'inherit'
        }
      );

      // Add to watched packages
      this.watchedPackages.add(packageName);

      // Start watching the store if not already watching
      if (!this.storeWatcher) {
        await this.startWatchingStore();
      }

      DR.logger.info(
        `Successfully installed ${packageName}@${packageEntry.currentVersion}`
      );
    } catch (error) {
      DR.logger.error(
        `Failed to install local package ${packageName}: ${String(error)}`
      );
      throw error;
    }
  }

  /**
   * Removes a package from local watching and installs the production version.
   *
   * @param packageName - Name of the package to uninstall locally
   */
  async uninstallLocalPackage(packageName: string): Promise<void> {
    try {
      DR.logger.info(
        `Removing local package ${packageName} and installing production version...`
      );

      // Remove from watched packages
      this.watchedPackages.delete(packageName);

      // Install the production version (without specifying registry to use default npm)
      await execa('npm', ['install', packageName], {
        stdio: 'inherit'
      });

      // Stop watching store if no packages are being watched
      if (this.watchedPackages.size === 0 && this.storeWatcher) {
        await this.storeWatcher.close();
        this.storeWatcher = null;
      }

      DR.logger.info(`Successfully uninstalled local package ${packageName}`);
    } catch (error) {
      DR.logger.error(
        `Failed to uninstall local package ${packageName}: ${String(error)}`
      );
      throw error;
    }
  }

  /**
   * Lists all locally installed packages that are being watched.
   */
  getWatchedPackages(): string[] {
    return Array.from(this.watchedPackages);
  }

  /**
   * Updates the package.json in the current directory to use local versions of specified packages.
   *
   * @param packageNames - Array of package names to switch to local versions
   */
  async updatePackageJsonForLocal(packageNames: string[]): Promise<void> {
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    if (!(await fs.pathExists(packageJsonPath))) {
      throw new Error('No package.json found in current directory');
    }

    const store = await LocalPackageStoreService.getStore();
    const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;
    let hasChanges = false;

    for (const packageName of packageNames) {
      const packageEntry = store.packages[packageName];

      if (!packageEntry) {
        DR.logger.warn(`Local version not found for ${packageName}, skipping`);
        continue;
      }

      // Update in dependencies
      if (packageJson.dependencies && packageJson.dependencies[packageName]) {
        packageJson.dependencies[packageName] = packageEntry.currentVersion;
        hasChanges = true;
        DR.logger.info(
          `Updated ${packageName} to ${packageEntry.currentVersion} in dependencies`
        );
      }

      // Update in devDependencies
      if (
        packageJson.devDependencies &&
        packageJson.devDependencies[packageName]
      ) {
        packageJson.devDependencies[packageName] = packageEntry.currentVersion;
        hasChanges = true;
        DR.logger.info(
          `Updated ${packageName} to ${packageEntry.currentVersion} in devDependencies`
        );
      }

      // Update in peerDependencies
      if (
        packageJson.peerDependencies &&
        packageJson.peerDependencies[packageName]
      ) {
        packageJson.peerDependencies[packageName] = packageEntry.currentVersion;
        hasChanges = true;
        DR.logger.info(
          `Updated ${packageName} to ${packageEntry.currentVersion} in peerDependencies`
        );
      }
    }

    if (hasChanges) {
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      DR.logger.info('Updated package.json with local versions');
    } else {
      DR.logger.info('No changes needed in package.json');
    }
  }

  /**
   * Stops watching the local package store.
   */
  async stopWatching(): Promise<void> {
    if (this.storeWatcher) {
      await this.storeWatcher.close();
      this.storeWatcher = null;
      DR.logger.info('Stopped watching local package store');
    }
  }

  /**
   * Starts watching the local package store for changes.
   */
  private async startWatchingStore(): Promise<void> {
    const config = await ConfigService.loadConfig();
    const storeFilePath = path.join(
      config.storeLocation || process.cwd(),
      '.local-package-store.json'
    );

    this.storeWatcher = watch(storeFilePath, {
      ignoreInitial: true,
      persistent: true
    });

    this.storeWatcher.on('change', () => {
      void (async () => {
        try {
          DR.logger.info(
            'Local package store updated, checking for package updates...'
          );
          await this.handleStoreUpdate();
        } catch (error) {
          DR.logger.error(`Error handling store update: ${String(error)}`);
        }
      })();
    });

    DR.logger.info('Started watching local package store for updates');
  }

  /**
   * Handles updates to the local package store.
   */
  private async handleStoreUpdate(): Promise<void> {
    const config = await ConfigService.loadConfig();
    const registryUrl = config.watch?.registryUrl || 'http://localhost:4873';
    const store = await LocalPackageStoreService.getStore();

    for (const packageName of this.watchedPackages) {
      const newVersion = store.packages[packageName]?.currentVersion;

      if (newVersion) {
        try {
          DR.logger.info(`Updating ${packageName} to ${newVersion}...`);

          // Update package.json first
          await this.updatePackageJsonForLocal([packageName]);

          // Install the new version
          await execa(
            'npm',
            [
              'install',
              `${packageName}@${newVersion}`,
              '--registry',
              registryUrl
            ],
            {
              stdio: 'pipe' // Use pipe to avoid cluttering output
            }
          );

          DR.logger.info(
            `Successfully updated ${packageName} to ${newVersion}`
          );
        } catch (error) {
          DR.logger.error(`Failed to update ${packageName}: ${String(error)}`);
        }
      }
    }
  }
}
