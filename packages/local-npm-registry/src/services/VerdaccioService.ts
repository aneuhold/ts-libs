/* eslint-disable @typescript-eslint/no-misused-promises */
import { DR } from '@aneuhold/core-ts-lib';
import { fork, type ChildProcess } from 'child_process';
import { execa } from 'execa';
import fs from 'fs-extra';
import http from 'http';
import { createRequire } from 'module';
import path from 'path';
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

      // Create Verdaccio configuration file
      const configPath = await this.createVerdaccioConfigFile(config);

      DR.logger.info(`Starting Verdaccio on port ${port}...`);

      // Start Verdaccio using fork
      await this.startVerdaccioFork(configPath, port);

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
   * @param port - Port to listen on
   */
  private async startVerdaccioFork(
    configPath: string,
    port: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create require function for ES modules
        const require = createRequire(import.meta.url);

        DR.logger.info('Creating Verdaccio fork...');

        // Fork Verdaccio process with debugging enabled
        const childFork = fork(
          require.resolve('verdaccio/bin/verdaccio'),
          ['--config', configPath, '--listen', `localhost:${port}`],
          {
            silent: false, // Allow stdio to see what's happening
            detached: false, // Keep attached to parent
            env: {
              ...process.env,
              DEBUG: 'verdaccio*' // Enable debug messages
            }
          }
        );

        DR.logger.info('Verdaccio fork created, waiting for startup...');

        // Listen for the verdaccio_started message (primary method)
        childFork.on('message', (msg: { verdaccio_started?: boolean }) => {
          DR.logger.info(
            `Received message from Verdaccio: ${JSON.stringify(msg)}`
          );
          if (msg.verdaccio_started) {
            this.verdaccioProcess = childFork;
            resolve();
          }
        });

        // Handle errors
        childFork.on('error', (err: Error) => {
          DR.logger.error(`Verdaccio fork error: ${err.message}`);
          reject(err);
        });

        // Handle disconnect
        childFork.on('disconnect', () => {
          DR.logger.error('Verdaccio fork disconnected');
          if (!this.verdaccioProcess) {
            reject(new Error('Verdaccio process disconnected before starting'));
          }
        });

        // Handle process exit
        childFork.on('exit', (code: number | null, signal: string | null) => {
          DR.logger.info(
            `Verdaccio process exited with code ${code} and signal ${signal}`
          );
          this.verdaccioProcess = null;
        });

        // Use HTTP endpoint check as primary method since messaging might not work
        setTimeout(async () => {
          if (!this.verdaccioProcess) {
            DR.logger.info('Checking HTTP endpoint for startup...');
            try {
              // Wait for HTTP endpoint to be ready
              await this.waitForRegistry(port, 8000);
              this.verdaccioProcess = childFork;
              DR.logger.info('Verdaccio detected as running via HTTP check');
              resolve();
            } catch (error) {
              DR.logger.error(`HTTP check failed: ${String(error)}`);
              childFork.kill('SIGTERM');
              reject(
                new Error(
                  `Verdaccio failed to start within timeout: ${String(error)}`
                )
              );
            }
          }
        }, 2000); // Start HTTP check after 2 seconds
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error(`Failed to start Verdaccio fork: ${String(error)}`)
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
   * Creates a Verdaccio configuration file and returns its path.
   *
   * @param config - The local npm configuration
   */
  private async createVerdaccioConfigFile(
    config: LocalNpmConfig
  ): Promise<string> {
    const tempDir = path.join(
      config.storeLocation || process.cwd(),
      '.verdaccio'
    );

    // Ensure temp directory exists
    await fs.ensureDir(tempDir);

    const configPath = path.join(tempDir, 'config.yaml');
    const verdaccioConfig = this.createVerdaccioConfig(config, tempDir);

    // Convert config object to YAML string
    const yamlContent = this.objectToYaml(verdaccioConfig);

    await fs.writeFile(configPath, yamlContent, 'utf8');

    return configPath;
  }

  /**
   * Creates a basic Verdaccio configuration object.
   *
   * @param config - The local npm configuration
   * @param tempDir - The temporary directory for Verdaccio storage
   */
  private createVerdaccioConfig(
    config: LocalNpmConfig,
    tempDir: string
  ): Record<string, unknown> {
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
      logs: {
        type: 'stdout',
        format: 'pretty',
        level: 'info'
      },
      self_path: tempDir,
      _debug: true, // Enable debug mode for fork messaging
      ...config.watch?.verdaccioConfig
    };

    return verdaccioConfig;
  }

  /**
   * Waits for the registry to be available.
   *
   * @param port - The port to check
   * @param timeout - Timeout in milliseconds
   */
  private async waitForRegistry(port: number, timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await this.isRunning()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`Verdaccio failed to start within ${timeout}ms`);
  }

  /**
   * Converts an object to a simple YAML string.
   *
   * @param obj - The object to convert
   * @param indent - The indentation level for formatting
   */
  private objectToYaml(obj: Record<string, unknown>, indent = 0): string {
    const spaces = ' '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      // Quote keys that contain special characters
      const quotedKey = this.needsQuoting(key) ? `"${key}"` : key;

      if (value === null || value === undefined) {
        yaml += `${spaces}${quotedKey}: null\n`;
      } else if (typeof value === 'string') {
        yaml += `${spaces}${quotedKey}: "${value}"\n`;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        yaml += `${spaces}${quotedKey}: ${value}\n`;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        yaml += `${spaces}${quotedKey}:\n`;
        yaml += this.objectToYaml(value as Record<string, unknown>, indent + 2);
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${quotedKey}:\n`;
        for (const item of value) {
          if (typeof item === 'string') {
            yaml += `${spaces}  - "${item}"\n`;
          } else {
            yaml += `${spaces}  - ${item}\n`;
          }
        }
      } else {
        yaml += `${spaces}${quotedKey}: ${JSON.stringify(value)}\n`;
      }
    }

    return yaml;
  }

  /**
   * Checks if a YAML key needs to be quoted.
   *
   * @param key - The key to check
   */
  private needsQuoting(key: string): boolean {
    // Quote keys that contain special characters that could be problematic in YAML
    return (
      /[@*{}[\]|>!%&]/.test(key) || key.startsWith('*') || key.includes('*')
    );
  }
}
