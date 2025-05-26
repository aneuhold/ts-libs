/* eslint-disable @typescript-eslint/no-misused-promises */
import { DR } from '@aneuhold/core-ts-lib';
import type { Config as VerdaccioConfig } from '@verdaccio/types';
import { type ChildProcess } from 'child_process';
import { execa } from 'execa';
import http from 'http';
import path from 'path';
import { runServer } from 'verdaccio';
import type { LocalNpmConfig } from '../types/LocalNpmConfig.js';
import type { RegistryStatus } from '../types/WatchConfig.js';
import { ConfigService } from './ConfigService.js';

/**
 * Service to manage the local Verdaccio registry.
 */
export class VerdaccioService {
  private static instance: VerdaccioService | null = null;
  private verdaccioProcess: ChildProcess | null = null;
  private isStarting = false;

  /**
   * Gets the singleton instance of the VerdaccioService.
   */
  static getInstance(): VerdaccioService {
    if (!VerdaccioService.instance) {
      VerdaccioService.instance = new VerdaccioService();
    }
    return VerdaccioService.instance;
  }

  /**
   * Gets the status of the Verdaccio registry.
   */
  async getStatus(): Promise<RegistryStatus> {
    const config = await ConfigService.loadConfig();
    const port = config.watch?.registryPort || 4873;
    const url = config.watch?.registryUrl || `http://localhost:${port}`;

    return {
      port,
      url
    };
  }

  /**
   * Starts the Verdaccio registry using a child process fork.
   */
  async start(): Promise<void> {
    if (this.isStarting) {
      DR.logger.info('Verdaccio is already starting...');
      return;
    }

    if (await this.isRunning()) {
      DR.logger.info('Verdaccio is already running');
      return;
    }

    this.isStarting = true;

    try {
      const config = await ConfigService.loadConfig();
      const port = config.watch?.registryPort || 4873;

      DR.logger.info(`Starting Verdaccio on port ${port}...`);

      // Start Verdaccio using the fork method
      await this.startVerdaccio(config);

      DR.logger.info(
        `Verdaccio started successfully on http://localhost:${port}`
      );
    } catch (error) {
      DR.logger.error(`Failed to start Verdaccio: ${String(error)}`);
      this.verdaccioProcess = null;
      throw error;
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Starts Verdaccio using the fork method from child_process.
   *
   * @param configPath - Path to the Verdaccio configuration file
   * @param config
   * @param port - Port to listen on
   */
  private async startVerdaccio(config: LocalNpmConfig): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        DR.logger.info('Starting Verdaccio server...');

        const verdaccioServer = (await runServer(
          VerdaccioService.createVerdaccioConfig(config) as unknown as string
        )) as http.Server;

        DR.logger.info('Verdaccio server created, waiting for startup...');

        verdaccioServer.on('verdaccio_started', () => {
          DR.logger.info(`Verdaccio server started`);
          resolve();
        });
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error(`Failed to start Verdaccio server: ${String(error)}`)
        );
      }
    });
  }

  /**
   * Stops the Verdaccio registry.
   */
  async stop(): Promise<void> {
    if (!this.verdaccioProcess) {
      DR.logger.info('Verdaccio is not running');
      return;
    }

    try {
      // Kill the process
      this.verdaccioProcess.kill('SIGTERM');

      // Wait for the process to exit with a timeout
      const timeout = new Promise<void>((resolve) => {
        setTimeout(() => {
          if (this.verdaccioProcess) {
            this.verdaccioProcess.kill('SIGKILL');
            this.verdaccioProcess = null;
          }
          resolve();
        }, 5000);
      });

      const processEnd = new Promise<void>((resolve) => {
        if (this.verdaccioProcess) {
          this.verdaccioProcess.on('exit', () => {
            this.verdaccioProcess = null;
            resolve();
          });
        } else {
          resolve();
        }
      });

      await Promise.race([processEnd, timeout]);
      DR.logger.info('Verdaccio stopped');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      DR.logger.error(`Error stopping Verdaccio: ${errorMessage}`);
      this.verdaccioProcess = null;
    }
  }

  /**
   * Publishes a package to the local Verdaccio registry.
   *
   * @param packagePath - Path to the package directory containing package.json
   */
  async publishPackage(packagePath: string): Promise<void> {
    const config = await ConfigService.loadConfig();
    const registryUrl = config.watch?.registryUrl || 'http://localhost:4873';

    try {
      // Ensure the registry is running
      if (!(await this.isRunning())) {
        if (config.watch?.autoStartRegistry !== false) {
          await this.start();
        } else {
          throw new Error(
            'Verdaccio registry is not running and autoStartRegistry is disabled'
          );
        }
      }

      DR.logger.info(
        `Publishing package from ${packagePath} to ${registryUrl}...`
      );

      // Use npm publish with the local registry
      await execa('npm', ['publish', '--registry', registryUrl], {
        cwd: packagePath,
        stdio: 'inherit'
      });

      DR.logger.info('Package published successfully');
    } catch (error) {
      DR.logger.error(`Failed to publish package: ${String(error)}`);
      throw error;
    }
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

    // Just a partial, because VerdaccioConfig seems to contain unnecessary
    // required properties that we don't need to set.
    const verdaccioConfig: Partial<VerdaccioConfig> = {
      storage: path.join(storageLocation, 'verdaccio-storage'),
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
        level: 'info'
      },
      _debug: true,
      self_path: path.join(storageLocation, 'verdaccio-self'),
      ...config.watch?.verdaccioConfig
    };

    return verdaccioConfig as VerdaccioConfig;
  }
}
