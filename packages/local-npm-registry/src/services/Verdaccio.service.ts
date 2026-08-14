import { DR } from '@aneuhold/core-ts-lib';
import type {
  UpLinksConfList,
  Config as VerdaccioConfig,
  PackageList as VerdaccioPackageList
} from '@verdaccio/types';
import fs from 'fs-extra';
import http from 'http';
import path from 'path';
import { runServer } from 'verdaccio';
import { DEFAULT_CONFIG, type LocalNpmConfig } from '../types/LocalNpmConfig.js';
import { VERDACCIO_DB_FILE_NAME, isVerdaccioDb } from '../types/VerdaccioDb.js';
import { ConfigService } from './Config.service.js';
import { LocalPackageVersionService } from './LocalPackageVersion.service.js';
import { NpmrcService } from './Npmrc.service.js';
import { PackageJsonService } from './PackageJson.service.js';
import { PackageManagerCliService } from './PackageManagerService/PackageManagerCli.service.js';

type StrictVerdaccioConfig = Partial<VerdaccioConfig> & {
  storage: string; // Ensure storage is always a string
};

/**
 * Service to manage the local Verdaccio registry.
 */
export class VerdaccioService {
  /**
   * Locally-typed alias for the Verdaccio `runServer` export. The published
   * Verdaccio types do not narrow the signature to what the runtime actually
   * accepts, and JSR publishing forbids modifying global module types via
   * `declare module`, so we cast through `unknown` at a single site instead.
   *
   * See: https://github.com/verdaccio/verdaccio/blob/master/packages/node-api/src/server.ts
   */
  static readonly #verdaccioRunServer =
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    runServer as unknown as (config: Partial<VerdaccioConfig>) => Promise<http.Server>;

  static #verdaccioServer: http.Server | null = null;
  static #isStarting = false;
  static #_verdaccioConfig: StrictVerdaccioConfig | null = null;

  static get verdaccioConfig(): StrictVerdaccioConfig {
    if (!this.#_verdaccioConfig) {
      throw new Error('Verdaccio configuration not initialized');
    }
    return this.#_verdaccioConfig;
  }

  /**
   * Starts the Verdaccio registry server.
   * This must be called before any npm publish commands can work.
   *
   * The caller holds the mutex lock, so only one process reaches this and the
   * port is never contended.
   */
  static async start(): Promise<void> {
    await this.#loadVerdaccioConfig();

    if (this.#isStarting) {
      DR.logger.info('Verdaccio is already starting...');
      return;
    }

    if (this.#verdaccioServer) {
      DR.logger.info('Verdaccio is already running');
      return;
    }

    this.#isStarting = true;

    try {
      const config = await ConfigService.loadConfig();
      const port = config.registryPort || DEFAULT_CONFIG.registryPort;

      DR.logger.info(`Starting Verdaccio on port ${port}...`);

      await this.#startVerdaccio(config);

      DR.logger.info(`Verdaccio started successfully on http://localhost:${port}`);
    } catch (error) {
      DR.logger.error(`Failed to start Verdaccio: ${String(error)}`);
      this.#verdaccioServer = null;
      throw error;
    } finally {
      this.#isStarting = false;
    }
  }

  /**
   * Stops the Verdaccio registry server.
   */
  static async stop(): Promise<void> {
    const server = this.#verdaccioServer;
    if (!server) {
      DR.logger.info('Verdaccio server is not running');
      return;
    }

    return new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          DR.logger.error(`Failed to stop Verdaccio server: ${String(error)}`);
          reject(error);
          return;
        }

        DR.logger.info('Verdaccio server stopped successfully');
        this.#verdaccioServer = null;
        resolve();
      });
    });
  }

  /**
   * Publishes a package to the local Verdaccio registry.
   * Note: Verdaccio must be started first using start() method.
   *
   * @param packagePath - Path to the package directory containing package.json
   * @param additionalPublishArgs - Additional arguments to pass to the npm publish command
   */
  static async publishPackage(
    packagePath: string,
    additionalPublishArgs: string[] = []
  ): Promise<void> {
    const registryUrl = await ConfigService.getLocalRegistryUrl();

    try {
      if (!VerdaccioService.#verdaccioServer) {
        throw new Error('Verdaccio server is not running. Call start() first.');
      }

      const packageJson = await PackageJsonService.getPackageInfo(packagePath);
      if (!packageJson || !packageJson.name) {
        throw new Error(
          `No valid package.json found in ${packagePath}. Ensure it contains a valid "name" field.`
        );
      }

      DR.logger.info(`Publishing package from ${packagePath} to ${registryUrl}...`);

      const publishOutput = await PackageManagerCliService.runNpmPublish(
        packagePath,
        packageJson.name,
        ['--tag', 'local', ...additionalPublishArgs]
      );

      DR.logger.info('Package published successfully');
      if (publishOutput) {
        DR.logger.info(publishOutput);
      }
    } catch (error) {
      let errorMessage = String(error);

      // Try to extract more meaningful error information from execa error
      if (error && typeof error === 'object') {
        const stderr = 'stderr' in error && typeof error.stderr === 'string' ? error.stderr : null;
        const stdout = 'stdout' in error && typeof error.stdout === 'string' ? error.stdout : null;
        if (stderr) {
          errorMessage = `npm publish failed: ${stderr}`;
        } else if (stdout) {
          errorMessage = `npm publish failed: ${stdout}`;
        }
      }

      DR.logger.error(`Failed to publish package: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Deletes every version of a package that a directory published, other than
   * one version to keep, then drops the package itself once no tarball of it is
   * left.
   *
   * The directory is addressed by the slug its versions carry rather than by
   * the versions the store names, so a version the store lost track of is
   * deleted too.
   *
   * @param packageName - The name of the package to remove versions of
   * @param packagePath - The publishing directory whose versions to remove
   * @param versionToKeep - The one version of that directory to leave in place
   */
  static async removeVersionsPublishedFrom(
    packageName: string,
    packagePath: string,
    versionToKeep?: string
  ): Promise<void> {
    await this.#loadVerdaccioConfig();

    const packageStorage = path.join(this.verdaccioConfig.storage, ...packageName.split('/'));
    if (!(await fs.pathExists(packageStorage))) {
      return;
    }

    const tarballBaseName = packageName.split('/').pop() ?? packageName;
    const keptTarball = versionToKeep ? `${tarballBaseName}-${versionToKeep}.tgz` : undefined;
    const publishedFromPath = new RegExp(
      `${LocalPackageVersionService.getSuffixRegex(packagePath).source}\\.tgz$`
    );

    for (const fileName of await fs.readdir(packageStorage)) {
      if (fileName === keptTarball || !publishedFromPath.test(fileName)) {
        continue;
      }

      try {
        await fs.remove(path.join(packageStorage, fileName));
        DR.logger.info(`Removed ${fileName} from the local registry`);
      } catch (error) {
        DR.logger.warn(`Could not remove ${fileName} from the local registry: ${String(error)}`);
      }
    }

    // A directory holding no tarball survives as a metadata document naming
    // versions that have nothing behind them, and the database goes on listing
    // the package as one the registry holds, so both go with the last tarball.
    // A tarball another directory published keeps them
    try {
      if (!(await fs.readdir(packageStorage)).some((fileName) => fileName.endsWith('.tgz'))) {
        await fs.remove(packageStorage);
        await this.#removePackageFromVerdaccioDb(packageName);
        DR.logger.info(
          `Removed ${packageName} from the local registry, which holds no version of it`
        );
      }
    } catch (error) {
      DR.logger.warn(`Could not remove ${packageName} from the local registry: ${String(error)}`);
    }
  }

  /**
   * Deletes everything the registry holds, which is what a command discarding
   * the whole store uses to collect the versions every other command left
   * behind. Proxied packages are re-fetched, since the storage is their cache.
   *
   * The server does not have to be running, and should not be.
   */
  static async clearStorage(): Promise<void> {
    await this.#loadVerdaccioConfig();

    await fs.remove(this.verdaccioConfig.storage);

    DR.logger.info('Cleared the local registry storage');
  }

  /**
   * Starts Verdaccio using the runServer function.
   * Verdaccio will automatically stop when the process exits.
   *
   * @param config - The local npm configuration
   */
  static async #startVerdaccio(config: LocalNpmConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      VerdaccioService.#verdaccioRunServer(this.verdaccioConfig)
        .then((verdaccioServer: http.Server) => {
          VerdaccioService.#verdaccioServer = verdaccioServer;

          DR.logger.info('Verdaccio server created, starting to listen...');

          // Get the port from config or use default
          const port = config.registryPort || DEFAULT_CONFIG.registryPort;

          // Start listening on the specified port
          verdaccioServer.listen(port, (error?: Error) => {
            if (error) {
              DR.logger.error(`Failed to start Verdaccio: ${String(error)}`);
              reject(error);
            } else {
              DR.logger.info(`Verdaccio server started successfully on port ${port}`);
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

  static async #loadVerdaccioConfig(): Promise<void> {
    const config = await ConfigService.loadConfig();
    if (!this.#_verdaccioConfig) {
      this.#_verdaccioConfig = await this.#createVerdaccioConfig(config);
    }
  }

  /**
   * Creates a basic Verdaccio configuration object.
   *
   * @param config - The local npm configuration
   */
  static async #createVerdaccioConfig(config: LocalNpmConfig): Promise<StrictVerdaccioConfig> {
    const dataDirectoryPath = await ConfigService.getDataDirectoryPath();
    const verdaccioDirectory = path.join(dataDirectoryPath, 'verdaccio');
    const isVerbose = DR.logger.isVerboseLoggingEnabled();

    // Get all npmrc configurations from current directory up the tree
    const npmrcConfigs = await NpmrcService.getAllNpmrcConfigs();

    // Parse npmrc configurations to extract organization registries and auth tokens
    const { uplinks, packages } = this.#parseNpmrcForVerdaccio(npmrcConfigs);

    // Base uplinks and packages configuration
    const baseUplinks: UpLinksConfList = {
      npmjs: {
        url: 'https://registry.npmjs.org/'
      },
      ...uplinks
    };

    const basePackages: VerdaccioPackageList = {
      '@*/*': {
        access: ['$all'],
        publish: ['$all'],
        proxy: ['npmjs']
      },
      '**': {
        access: ['$all'],
        publish: ['$all'],
        proxy: ['npmjs']
      },
      ...packages
    };

    // VerdaccioConfig contains unnecessary required properties that we do not
    // need to set. StrictVerdaccioConfig only guarantees `storage` is present.
    const verdaccioConfig: StrictVerdaccioConfig = {
      // Storage is managed manually by local-npm-registry.
      storage: verdaccioDirectory,
      uplinks: baseUplinks,
      packages: basePackages,
      log: {
        type: 'stdout',
        format: 'pretty',
        level: isVerbose ? 'info' : 'fatal'
      },
      debug: isVerbose,
      // Not quite sure what this impacts, but Verdaccio requires it
      self_path: verdaccioDirectory,
      ...config.verdaccioConfig
    };

    return verdaccioConfig;
  }

  /**
   * Drops a package name from the registry database, which is the list
   * Verdaccio reads to know which packages it holds itself rather than proxies.
   *
   * @param packageName - The name of the package to drop
   */
  static async #removePackageFromVerdaccioDb(packageName: string): Promise<void> {
    const dbFilePath = path.join(this.verdaccioConfig.storage, VERDACCIO_DB_FILE_NAME);

    if (!(await fs.pathExists(dbFilePath))) {
      return;
    }

    const dbContent: unknown = await fs.readJson(dbFilePath);
    if (!isVerdaccioDb(dbContent)) {
      DR.logger.warn(`Verdaccio database at ${dbFilePath} is not in the expected format`);
      return;
    }

    if (!dbContent.list.includes(packageName)) {
      return;
    }

    dbContent.list = dbContent.list.filter((name) => name !== packageName);
    await fs.writeJson(dbFilePath, dbContent);
  }

  /**
   * Parses npmrc configurations to extract organization-specific registries and auth tokens
   * for Verdaccio uplinks and packages configuration.
   *
   * @param npmrcConfigs - Map of npmrc key-value pairs
   */
  static #parseNpmrcForVerdaccio(npmrcConfigs: Map<string, string>): {
    uplinks: UpLinksConfList;
    packages: VerdaccioPackageList;
  } {
    const uplinks: UpLinksConfList = {};
    const packages: VerdaccioPackageList = {};
    const registryToUplink = new Map<string, string>();

    // Process all npmrc configurations
    for (const [key, value] of npmrcConfigs) {
      // Look for organization-specific registry configurations: @org:registry=URL
      const orgRegistryMatch = key.match(/^@([^:]+):registry$/);
      if (orgRegistryMatch) {
        const org = orgRegistryMatch[1];
        const registryUrl = value;

        // Create a safe uplink name from the registry URL
        const uplinkName = this.#createUplinkName(registryUrl);
        registryToUplink.set(registryUrl, uplinkName);

        // Create uplink configuration
        uplinks[uplinkName] = {
          url: registryUrl
        };

        // Create package configuration for this organization
        packages[`@${org}/*`] = {
          access: ['$all'],
          publish: ['$all'],
          proxy: [uplinkName]
        };
      }
    }

    // Look for auth tokens and add them to existing uplinks
    for (const [key, value] of npmrcConfigs) {
      // Look for auth tokens: //registry.url/:_authToken=token
      const authTokenMatch = key.match(/^\/\/([^/]+)\/:_authToken$/);
      if (authTokenMatch) {
        const registryHost = authTokenMatch[1];
        const token = value;

        // Find the corresponding uplink by matching the host
        for (const [registryUrl, uplinkName] of registryToUplink) {
          const registryHost2 = registryUrl.replace(/^https?:\/\//, '');
          if (registryHost === registryHost2) {
            // Add auth configuration to the uplink
            uplinks[uplinkName].auth = {
              type: 'Bearer',
              token: token
            };
            break;
          }
        }
      }
    }

    return { uplinks, packages };
  }

  /**
   * Creates a safe uplink name from a registry URL.
   *
   * @param registryUrl - The registry URL
   */
  static #createUplinkName(registryUrl: string): string {
    // Remove protocol and common endings to create a clean name
    let name = registryUrl
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .replace(/\./g, '')
      .replace(/[^a-zA-Z0-9]/g, '');

    // Ensure it doesn't conflict with default uplinks
    if (name === 'npmjs') {
      name = `${name}custom`;
    }

    return name;
  }
}
