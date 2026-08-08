import { DR } from '@aneuhold/core-ts-lib';
import { execa } from 'execa';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { DEFAULT_CONFIG } from '../../types/LocalNpmConfig.js';
import type { LocalPackageStore } from '../../types/LocalPackageStore.js';
import {
  PACKAGE_MANAGER_INFO,
  PackageManager,
  type PackageManagerRegistryOverride
} from '../../types/PackageManager.js';
import { ConfigService } from '../Config.service.js';
import { LocalPackageStoreService } from '../LocalPackageStore.service.js';
import { PackageJsonService } from '../PackageJson.service.js';

/**
 * Service that builds and runs package manager commands.
 */
export class PackageManagerCliService {
  static readonly #YARN_BERRY_CONFIG_FILE = '.yarnrc.yml';

  /**
   * Runs the install command for a project using the default registry (npm, yarn, etc.).
   *
   * @param projectPath - Path to the project directory
   * @param packageManager - The package manager to run
   * @param registryOverride - Arguments and environment variables that redirect the registry
   */
  static async runInstall(
    projectPath: string,
    packageManager: PackageManager,
    registryOverride?: PackageManagerRegistryOverride
  ): Promise<void> {
    const packageManagerInfo = PACKAGE_MANAGER_INFO[packageManager];

    try {
      DR.logger.info(`Running ${packageManagerInfo.displayName} install in ${projectPath}`);

      // Create clean environment by removing npm_config_ variables that interfere with local registry.
      // This is required because sometimes (like pnpm) the package manager will inject environment
      // variables that point to the global npm registry, which we want to avoid
      // when using a local registry.
      const cleanEnv = { ...process.env };
      Object.keys(cleanEnv).forEach((key) => {
        if (key.startsWith('npm_config_')) {
          delete cleanEnv[key];
        }
      });

      await execa(packageManagerInfo.command, ['install', ...(registryOverride?.args ?? [])], {
        cwd: projectPath,
        env: { ...cleanEnv, ...registryOverride?.env },
        extendEnv: false
      });

      DR.logger.info(`${packageManagerInfo.displayName} install completed in ${projectPath}`);
    } catch (error) {
      DR.logger.error(`Error running install in ${projectPath}: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Runs the install command for a project using the specified registry.
   *
   * The redirection is passed to the install command itself, so nothing in the
   * project directory is modified.
   *
   * @param projectPath - Path to the project directory
   * @param packageManager - The package manager to run
   * @param store - The store to read the project's subscriptions from
   * @param registryUrl - The registry URL to use for installation
   */
  static async runInstallWithRegistry(
    projectPath: string,
    packageManager: PackageManager,
    store: LocalPackageStore,
    registryUrl?: string
  ): Promise<void> {
    const config = await ConfigService.loadConfig();
    const actualRegistryUrl = registryUrl || config.registryUrl || DEFAULT_CONFIG.registryUrl;

    const registryOverride = await this.#buildRegistryOverride(
      packageManager,
      actualRegistryUrl,
      projectPath,
      store
    );

    await this.runInstall(projectPath, packageManager, registryOverride);
  }

  /**
   * Builds the arguments and environment variables that point a package manager at
   * a registry for a single invocation, leaving every configuration file in the
   * project untouched.
   *
   * @param packageManager The package manager that runs the command
   * @param registryUrl The registry URL that packages have to resolve from
   * @param projectPath The path to the project directory
   * @param store The store to read the project's subscriptions from
   */
  static async #buildRegistryOverride(
    packageManager: PackageManager,
    registryUrl: string,
    projectPath: string,
    store: LocalPackageStore
  ): Promise<PackageManagerRegistryOverride> {
    const organizations = this.#resolvePackageOrganizations(projectPath, store);

    if (packageManager === PackageManager.Yarn4) {
      await this.#warnOnPinnedYarn4Scopes(projectPath, organizations);
    }

    return PACKAGE_MANAGER_INFO[packageManager].getRegistryOverrideCliOptions(
      registryUrl,
      organizations
    );
  }

  /**
   * Resolves the scopes that have to be redirected for a project, which are the
   * scopes of every package the project is subscribed to.
   *
   * @param projectPath The path to the project directory
   * @param store The store to read the project's subscriptions from
   */
  static #resolvePackageOrganizations(projectPath: string, store: LocalPackageStore): string[] {
    const subscriptions = LocalPackageStoreService.getSubscriptionsForSubscriber(
      store,
      projectPath
    );
    const organizations = new Set<string>();

    for (const { packageName } of subscriptions) {
      const organization = PackageJsonService.extractOrganization(packageName);
      if (organization) {
        organizations.add(organization);
      }
    }

    return Array.from(organizations);
  }

  /**
   * Warns about scopes that Yarn 4 resolves from the project's own
   * `.yarnrc.yml`. An `npmScopes` entry outranks `YARN_NPM_REGISTRY_SERVER` and
   * Yarn Berry rejects `YARN_NPM_SCOPES`, so such a scope cannot be redirected.
   *
   * @param projectPath The path to the project directory
   * @param organizations The scopes that have to be redirected
   */
  static async #warnOnPinnedYarn4Scopes(
    projectPath: string,
    organizations: string[]
  ): Promise<void> {
    if (organizations.length === 0) {
      return;
    }

    const configPath = path.join(projectPath, PackageManagerCliService.#YARN_BERRY_CONFIG_FILE);
    if (!(await fs.pathExists(configPath))) {
      return;
    }

    let npmScopes: unknown;
    try {
      const parsedConfig: unknown = yaml.load(await fs.readFile(configPath, 'utf8'));
      if (typeof parsedConfig !== 'object' || parsedConfig === null) {
        return;
      }
      npmScopes = 'npmScopes' in parsedConfig ? parsedConfig.npmScopes : undefined;
    } catch {
      // An unreadable config is Yarn's problem to report, not this warning's
      return;
    }

    if (typeof npmScopes !== 'object' || npmScopes === null) {
      return;
    }

    const pinnedScopes = organizations
      .filter((organization) => organization in npmScopes)
      .map((organization) => `@${organization}`);

    if (pinnedScopes.length > 0) {
      DR.logger.warn(
        `${PackageManagerCliService.#YARN_BERRY_CONFIG_FILE} in ${projectPath} sets npmScopes for ${pinnedScopes.join(', ')}. Yarn Berry resolves those ahead of the local registry, so they install from the registry configured there instead.`
      );
    }
  }
}
