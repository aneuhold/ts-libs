import { DR } from '@aneuhold/core-ts-lib';
import { execa } from 'execa';
import fs from 'fs-extra';
import http from 'http';
import path from 'path';
import { runServer } from 'verdaccio';
import type { RegistryStatus } from '../types/WatchConfig.js';
import { ConfigService } from './ConfigService.js';

/**
 * Service to manage the local Verdaccio registry.
 */
export class VerdaccioService {
  private static instance: VerdaccioService | null = null;
  private server: http.Server | null = null;
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
   * Checks if Verdaccio is running on the configured port.
   */
  async isRunning(): Promise<boolean> {
    const config = await ConfigService.loadConfig();
    const port = config.watch?.registryPort || 4873;

    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/',
          method: 'GET',
          timeout: 1000
        },
        (res) => {
          resolve(res.statusCode === 200);
        }
      );

      req.on('error', () => {
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * Gets the status of the Verdaccio registry.
   */
  async getStatus(): Promise<RegistryStatus> {
    const config = await ConfigService.loadConfig();
    const port = config.watch?.registryPort || 4873;
    const url = config.watch?.registryUrl || `http://localhost:${port}`;
    const isRunning = await this.isRunning();

    return {
      isRunning,
      port,
      url
    };
  }

  /**
   * Starts the Verdaccio registry using the programmatic API.
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

      // Create a basic Verdaccio configuration
      const verdaccioConfig = this.createVerdaccioConfig(config);

      DR.logger.info(`Starting Verdaccio on port ${port}...`);

      // Use Verdaccio's runServer method
      this.server = await runServer(verdaccioConfig);

      // Start listening on the configured port
      await new Promise<void>((resolve, reject) => {
        if (!this.server) {
          reject(new Error('Server not created'));
          return;
        }

        this.server.listen(port, 'localhost', () => {
          DR.logger.info(
            `Verdaccio started successfully on http://localhost:${port}`
          );
          resolve();
        });

        this.server.on('error', (err) => {
          DR.logger.error(`Failed to start Verdaccio: ${err.message}`);
          reject(err);
        });
      });
    } catch (error) {
      DR.logger.error(`Failed to start Verdaccio: ${String(error)}`);
      throw error;
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Stops the Verdaccio registry.
   */
  async stop(): Promise<void> {
    if (!this.server) {
      DR.logger.info('Verdaccio is not running');
      return;
    }

    return new Promise<void>((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        DR.logger.info('Verdaccio stopped');
        this.server = null;
        resolve();
      });
    });
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
   * @param config
   */
  private createVerdaccioConfig(config: any): any {
    const tempDir = path.join(
      config.storeLocation || process.cwd(),
      '.verdaccio'
    );

    // Ensure temp directory exists
    fs.ensureDirSync(tempDir);

    const verdaccioConfig = {
      storage: tempDir,
      auth: {
        htpasswd: {
          file: path.join(tempDir, 'htpasswd')
        }
      },
      uplinks: {
        npmjs: {
          url: 'https://registry.npmjs.org/'
        }
      },
      packages: {
        '@*/*': {
          access: '$all',
          publish: '$all',
          proxy: 'npmjs'
        },
        '**': {
          access: '$all',
          publish: '$all',
          proxy: 'npmjs'
        }
      },
      server: {
        keepAliveTimeout: 60
      },
      middlewares: {},
      logs: {
        type: 'stdout',
        format: 'pretty',
        level: 'info'
      },
      self_path: tempDir,
      ...config.watch?.verdaccioConfig
    };

    return verdaccioConfig;
  }
}
