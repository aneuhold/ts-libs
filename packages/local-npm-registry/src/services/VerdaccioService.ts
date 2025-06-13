import { DR } from '@aneuhold/core-ts-lib';
import type { Config as VerdaccioConfig } from '@verdaccio/types';
import { execa } from 'execa';
import fs from 'fs-extra';
import http from 'http';
import path from 'path';
import { runServer } from 'verdaccio';
import {
  DEFAULT_CONFIG,
  type LocalNpmConfig
} from '../types/LocalNpmConfig.js';
import {
  PACKAGE_MANAGER_INFO,
  PackageManager
} from '../types/PackageManager.js';
import {
  VERDACCIO_DB_FILE_NAME,
  type VerdaccioDb
} from '../types/VerdaccioDb.js';
import { ConfigService } from './ConfigService.js';
import { MutexService } from './MutexService.js';
import { PackageManagerService } from './PackageManagerService.js';

/**
 * Type definition for the Verdaccio runServer function.
 * This is used to ensure we can call it with the correct parameters, also
 * because the Verdaccio types are incorrect unfortunately.
 *
 * See the source code {@link https://github.com/verdaccio/verdaccio/blob/master/packages/node-api/src/server.ts here}.
 */
const verdaccioRunServer = runServer as unknown as (
  config: VerdaccioConfig
) => Promise<http.Server>;

type StrictVerdaccioConfig = VerdaccioConfig & {
  storage: string; // Ensure storage is always a string
};

/**
 * Service to manage the local Verdaccio registry.
 */
export class VerdaccioService {
  private static verdaccioServer: http.Server | null = null;
  private static isStarting = false;
  private static _verdaccioConfig: StrictVerdaccioConfig | null = null;

  static get verdaccioConfig(): StrictVerdaccioConfig {
    if (!this._verdaccioConfig) {
      throw new Error('Verdaccio configuration not initialized');
    }
    return this._verdaccioConfig;
  }

  /**
   * Starts the Verdaccio registry server.
   * This must be called before any npm publish commands can work.
   */
  static async start(): Promise<void> {
    await this.loadVerdaccioConfig();

    if (this.isStarting) {
      DR.logger.info('Verdaccio is already starting...');
      return;
    }

    if (this.verdaccioServer) {
      DR.logger.info('Verdaccio is already running');
      return;
    }

    this.isStarting = true;

    try {
      // Acquire mutex lock before starting Verdaccio
      await MutexService.acquireLock();

      const config = await ConfigService.loadConfig();
      const port = config.registryPort || DEFAULT_CONFIG.registryPort;

      DR.logger.info(`Starting Verdaccio on port ${port}...`);

      // Start Verdaccio server
      await this.startVerdaccio(config);

      DR.logger.info(
        `Verdaccio started successfully on http://localhost:${port}`
      );
    } catch (error) {
      DR.logger.error(`Failed to start Verdaccio: ${String(error)}`);
      this.verdaccioServer = null;

      // Release mutex lock if we acquired it but failed to start
      try {
        await MutexService.releaseLock();
      } catch (releaseError) {
        DR.logger.error(
          `Failed to release mutex lock after startup failure: ${String(releaseError)}`
        );
      }

      throw error;
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Stops the Verdaccio registry server.
   */
  static async stop(): Promise<void> {
    if (!this.verdaccioServer) {
      DR.logger.info('Verdaccio server is not running');
      return;
    }

    return new Promise((resolve, reject) => {
      const server = this.verdaccioServer;
      if (server) {
        server.close((error) => {
          if (error) {
            DR.logger.error(
              `Failed to stop Verdaccio server: ${String(error)}`
            );
            reject(error);
          } else {
            DR.logger.info('Verdaccio server stopped successfully');
            this.verdaccioServer = null;

            // Release mutex lock after stopping Verdaccio
            MutexService.releaseLock()
              .then(() => {
                DR.logger.info('Verdaccio mutex lock released successfully');
                resolve();
              })
              .catch((releaseError: unknown) => {
                DR.logger.error(
                  `Failed to release mutex lock after stopping: ${String(releaseError)}`
                );
                // Don't reject here, as the server was stopped successfully
                resolve();
              });
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Publishes a package to the local Verdaccio registry.
   * Note: Verdaccio must be started first using start() method.
   *
   * @param packagePath - Path to the package directory containing package.json
   */
  static async publishPackage(packagePath: string): Promise<void> {
    const config = await ConfigService.loadConfig();
    const registryUrl = config.registryUrl || DEFAULT_CONFIG.registryUrl;

    try {
      if (!VerdaccioService.verdaccioServer) {
        throw new Error('Verdaccio server is not running. Call start() first.');
      }

      const packageJson =
        await PackageManagerService.getPackageInfo(packagePath);
      if (!packageJson || !packageJson.name) {
        throw new Error(
          `No valid package.json found in ${packagePath}. Ensure it contains a valid "name" field.`
        );
      }

      // Clear any previously published package with the same name
      await VerdaccioService.clearPublishedPackagesLocally(packageJson.name);

      DR.logger.info(
        `Publishing package from ${packagePath} to ${registryUrl}...`
      );

      // Build npm publish arguments with direct registry and auth config
      const publishArgs = this.buildPublishArgs(packageJson.name, registryUrl);

      const npmInfo = PACKAGE_MANAGER_INFO[PackageManager.Npm];
      const result = await execa(npmInfo.command, publishArgs, {
        cwd: packagePath,
        stdio: 'pipe'
      });

      DR.logger.info('Package published successfully');
      if (result.stdout) {
        DR.logger.info(result.stdout);
      }
    } catch (error) {
      let errorMessage = String(error);

      // Try to extract more meaningful error information from execa error
      if (error && typeof error === 'object') {
        const execaError = error as { stderr?: string; stdout?: string };
        if (execaError.stderr) {
          errorMessage = `npm publish failed: ${execaError.stderr}`;
        } else if (execaError.stdout) {
          errorMessage = `npm publish failed: ${execaError.stdout}`;
        }
      }

      DR.logger.error(`Failed to publish package: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Unpublishes a package from the local Verdaccio registry.
   * This removes the package from the local Verdaccio storage.
   *
   * @param packageName - The name of the package to unpublish
   */
  static async unpublishPackage(packageName: string): Promise<void> {
    // Ensure the config is created
    await this.loadVerdaccioConfig();

    await this.clearPublishedPackagesLocally(packageName);
  }

  /**
   * Starts Verdaccio using the runServer function.
   * Verdaccio will automatically stop when the process exits.
   *
   * @param config - The local npm configuration
   */
  private static async startVerdaccio(config: LocalNpmConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      verdaccioRunServer(this.verdaccioConfig)
        .then((verdaccioServer: http.Server) => {
          VerdaccioService.verdaccioServer = verdaccioServer;

          DR.logger.info('Verdaccio server created, starting to listen...');

          // Get the port from config or use default
          const port = config.registryPort || DEFAULT_CONFIG.registryPort;

          // Start listening on the specified port
          verdaccioServer.listen(port, (error?: Error) => {
            if (error) {
              DR.logger.error(`Failed to start Verdaccio: ${String(error)}`);
              reject(error);
            } else {
              DR.logger.info(
                `Verdaccio server started successfully on port ${port}`
              );
              resolve();
            }
          });

          verdaccioServer.on('error', (error) => {
            DR.logger.error(`Verdaccio server error: ${String(error)}`);
            reject(error);
          });
        })
        .catch((error: unknown) => {
          DR.logger.error(`Error creating Verdaccio server: ${String(error)}`);
          reject(
            error instanceof Error
              ? error
              : new Error(`Failed to create Verdaccio server: ${String(error)}`)
          );
        });
    });
  }

  /**
   * Clears a specific published package from the local Verdaccio storage.
   * This removes the package from the .verdaccio-db.json file and deletes
   * the package folder from the verdaccio directory.
   *
   * @param packageName - The name of the package to clear from local storage
   */
  private static async clearPublishedPackagesLocally(
    packageName: string
  ): Promise<void> {
    try {
      const dbFilePath = path.join(
        this.verdaccioConfig.storage,
        VERDACCIO_DB_FILE_NAME
      );

      DR.logger.info(`Clearing package "${packageName}" locally...`);

      // Check if the database file exists
      if (await fs.pathExists(dbFilePath)) {
        // Read the current database
        const dbContent = (await fs.readJson(dbFilePath)) as VerdaccioDb;

        // Remove the specific package from the list
        if (dbContent.list.includes(packageName)) {
          dbContent.list = dbContent.list.filter((pkg) => pkg !== packageName);
          DR.logger.info(`Removed "${packageName}" from verdaccio database`);

          // Write the updated database back
          await fs.writeJson(dbFilePath, dbContent);
        } else {
          DR.logger.info(
            `Package "${packageName}" not found in verdaccio database`
          );
        }
      }

      // Remove the specific package directory from verdaccio storage
      const packagePath = path.join(
        this.verdaccioConfig.storage,
        ...packageName.split('/')
      );
      if (await fs.pathExists(packagePath)) {
        const stat = await fs.stat(packagePath).catch(() => null);

        if (stat?.isDirectory()) {
          await fs.remove(packagePath);
          DR.logger.info(`Removed package directory: ${packageName}`);
        }
      } else {
        DR.logger.info(
          `Package directory "${packageName}" not found in verdaccio storage`
        );
      }

      DR.logger.info(`Successfully cleared package "${packageName}" locally`);
    } catch (error) {
      DR.logger.error(
        `Failed to clear package "${packageName}" locally: ${String(error)}`
      );
      throw error;
    }
  }

  private static async loadVerdaccioConfig(): Promise<void> {
    const config = await ConfigService.loadConfig();
    if (!this._verdaccioConfig) {
      this._verdaccioConfig = await this.createVerdaccioConfig(config);
    }
  }

  /**
   * Creates a basic Verdaccio configuration object.
   *
   * @param config - The local npm configuration
   */
  private static async createVerdaccioConfig(
    config: LocalNpmConfig
  ): Promise<StrictVerdaccioConfig> {
    const dataDirectoryPath = await ConfigService.getDataDirectoryPath();
    const verdaccioDirectory = path.join(dataDirectoryPath, 'verdaccio');
    const isVerbose = DR.logger.isVerboseLoggingEnabled();

    // Just a partial, because VerdaccioConfig seems to contain unnecessary
    // required properties that we don't need to set.
    const verdaccioConfig: Partial<StrictVerdaccioConfig> = {
      // Storage is managed manually by local-npm-registry.
      storage: verdaccioDirectory,
      uplinks: {
        npmjs: {
          url: 'https://registry.npmjs.org/'
        },
        githubPackages: {
          url: 'https://npm.pkg.github.com'
        }
      },
      packages: {
        '@*/*': {
          access: ['$all'],
          publish: ['$all'],
          proxy: ['npmjs', 'githubPackages']
        },
        '**': {
          access: ['$all'],
          publish: ['$all'],
          proxy: ['npmjs', 'githubPackages']
        }
      },
      logs: {
        type: 'stdout',
        format: 'pretty',
        level: isVerbose ? 'info' : 'fatal'
      },
      debug: isVerbose,
      // Not quite sure what this impacts, but Verdaccio requires it
      self_path: verdaccioDirectory,
      ...config.verdaccioConfig
    };

    return verdaccioConfig as StrictVerdaccioConfig;
  }

  /**
   * Builds npm publish arguments with direct registry and auth token configuration.
   *
   * @param packageName - The name of the package being published
   * @param registryUrl - The registry URL to publish to
   */
  private static buildPublishArgs(
    packageName: string,
    registryUrl: string
  ): string[] {
    const args = ['publish'];

    // Extract organization from package name using PackageManagerService
    const org = PackageManagerService.extractOrganization(packageName);

    if (org) {
      // Scoped package: use --@org:registry format
      args.push(`--@${org}:registry=${registryUrl}`);
    } else {
      // Non-scoped package: use --registry format
      args.push(`--registry=${registryUrl}`);
    }

    // Add auth token for the registry
    const registryHost = registryUrl.replace(/^https?:\/\//, '');
    args.push(`--//${registryHost}/:_authToken=fake`);

    // Add other standard arguments
    args.push('--tag', 'local', '--ignore-scripts');

    return args;
  }
}
