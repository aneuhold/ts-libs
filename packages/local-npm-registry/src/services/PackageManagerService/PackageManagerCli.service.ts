import { DR } from '@aneuhold/core-ts-lib';
import { execa } from 'execa';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
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
    const resolvedRegistryUrl = registryUrl || (await ConfigService.getLocalRegistryUrl());
    const organizations = this.#resolvePackageOrganizations(projectPath, store);
    if (packageManager === PackageManager.Yarn4) {
      await this.#warnOnPinnedYarn4Scopes(projectPath, organizations);
    }

    await this.runInstall(
      projectPath,
      packageManager,
      PACKAGE_MANAGER_INFO[packageManager].getRegistryOverrideCliOptions(
        resolvedRegistryUrl,
        organizations
      )
    );
  }

  /**
   * Publishes a package to the local registry, returning what npm wrote to
   * stdout. We always use npm because it is universal and this doesn't depend on the project's
   * actual package manager.
   *
   * @param packagePath - Path to the directory of the package to publish
   * @param packageName - Name of the package to publish
   * @param additionalArgs - Additional arguments to pass to the publish command
   */
  static async runNpmPublish(
    packagePath: string,
    packageName: string,
    additionalArgs: string[] = []
  ): Promise<string> {
    const npmInfo = PACKAGE_MANAGER_INFO[PackageManager.Npm];

    // A package carries at most one scope, which is the only one a publish has
    // to redirect.
    const organization = PackageJsonService.extractOrganization(packageName);
    const scopesToRedirect = organization ? [organization] : [];

    const { args: registryArgs, env } = npmInfo.getRegistryOverrideCliOptions(
      await ConfigService.getLocalRegistryUrl(),
      scopesToRedirect
    );

    // The redirection goes last. npm takes the last occurrence of a flag, so a
    // caller cannot send the publish to a registry other than the local one
    const publishArgs = ['publish', ...additionalArgs, ...registryArgs];

    const { stdout } = await execa(npmInfo.command, publishArgs, {
      cwd: packagePath,
      env,
      stdio: 'pipe'
    });

    return stdout;
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
