import { DR } from '@aneuhold/core-ts-lib';
import type { Config as VerdaccioConfig } from '@verdaccio/types';
import { execa } from 'execa';
import http from 'http';
import path from 'path';
import { runServer } from 'verdaccio';
import type { LocalNpmConfig } from '../types/LocalNpmConfig.js';
import {
  PACKAGE_MANAGER_INFO,
  PackageManager
} from '../types/PackageManager.js';
import { ConfigService } from './ConfigService.js';
import { MutexService } from './MutexService.js';

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

/**
 * Service to manage the local Verdaccio registry.
 */
export class VerdaccioService {
  private static verdaccioServer: http.Server | null = null;
  private static isStarting = false;

  /**
   * Starts the Verdaccio registry server.
   * This must be called before any npm publish commands can work.
   */
  static async start(): Promise<void> {
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
      const port = config.registryPort || 4873;

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
    const registryUrl = config.registryUrl || 'http://localhost:4873';

    try {
      if (!VerdaccioService.verdaccioServer) {
        throw new Error('Verdaccio server is not running. Call start() first.');
      }

      DR.logger.info(
        `Publishing package from ${packagePath} to ${registryUrl}...`
      );

      // Use npm publish with the local registry. Also set the tag to 'local'.
      // A tag is required for NPM to publish pre-release versions.
      const npmInfo = PACKAGE_MANAGER_INFO[PackageManager.Npm];
      const result = await execa(
        npmInfo.command,
        ['publish', '--registry', registryUrl, '--tag', 'local'],
        {
          cwd: packagePath,
          stdio: 'pipe'
        }
      );

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
   * Starts Verdaccio using the runServer function.
   * Verdaccio will automatically stop when the process exits.
   *
   * @param config - The local npm configuration
   */
  private static async startVerdaccio(config: LocalNpmConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      verdaccioRunServer(VerdaccioService.createVerdaccioConfig(config))
        .then((verdaccioServer: http.Server) => {
          VerdaccioService.verdaccioServer = verdaccioServer;

          DR.logger.info('Verdaccio server created, starting to listen...');

          // Get the port from config or use default
          const port = config.registryPort || 4873;

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
   * Creates a basic Verdaccio configuration object.
   *
   * @param config - The local npm configuration
   */
  private static createVerdaccioConfig(
    config: LocalNpmConfig
  ): VerdaccioConfig {
    const storageLocation = config.storeLocation || '~';
    const isVerbose = DR.logger.isVerboseLoggingEnabled();

    // Just a partial, because VerdaccioConfig seems to contain unnecessary
    // required properties that we don't need to set.
    const verdaccioConfig: Partial<VerdaccioConfig> = {
      // Use in-memory storage to avoid conflicts between runs
      store: {
        memory: {
          limit: 1000
        }
      },
      uplinks: {
        npmjs: {
          url: 'https://registry.npmjs.org/'
        }
      },
      packages: {
        '@*/*': {
          access: ['$all'],
          publish: ['$all'],
          proxy: ['npmjs']
        },
        '**': {
          access: ['$all'],
          publish: ['$all'],
          proxy: ['npmjs']
        }
      },
      logs: {
        type: 'stdout',
        format: 'pretty',
        level: isVerbose ? 'info' : 'fatal'
      },
      debug: isVerbose,
      // Not quite sure what this impacts, but Verdaccio requires it
      self_path: path.join(storageLocation, 'verdaccio-self'),
      ...config.verdaccioConfig
    };

    return verdaccioConfig as VerdaccioConfig;
  }
}
