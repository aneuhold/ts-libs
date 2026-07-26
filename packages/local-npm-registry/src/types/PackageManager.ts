/**
 * Supported package managers.
 */
export enum PackageManager {
  Npm = 'npm',
  Pnpm = 'pnpm',
  Yarn = 'yarn',
  Yarn4 = 'yarn4'
}

/**
 * Information about a package manager including commands and helpful details.
 */
export type PackageManagerInfo = {
  /** The command to execute the package manager */
  command: string;
  /** Lock file name used by this package manager */
  lockFile: string;
  /**
   * Builds the redirection that points this package manager at the given registry
   * for a single invocation. Organizations are the scopes that have to resolve
   * from that registry.
   */
  getRegistryOverrideCliOptions: (
    registryUrl: string,
    organizations: string[]
  ) => PackageManagerRegistryOverride;
  /** Display name for user-facing messages */
  displayName: string;
};

/**
 * Registry redirection for a single package manager invocation, expressed as
 * command line arguments and environment variables.
 */
export type PackageManagerRegistryOverride = {
  /** Arguments to append to the package manager command */
  args: string[];
  /** Environment variables to set for the package manager process */
  env: Record<string, string>;
};

/**
 * Static constant map containing information for each package manager.
 * This serves as the single source of truth for package manager details.
 */
export const PACKAGE_MANAGER_INFO: Record<PackageManager, PackageManagerInfo> = {
  [PackageManager.Npm]: {
    command: 'npm',
    lockFile: 'package-lock.json',
    // The scoped flags are load bearing. `--registry` alone sits below a project
    // `.npmrc` for any scope that file configures explicitly.
    getRegistryOverrideCliOptions: (registryUrl, organizations) => ({
      args: [
        `--registry=${registryUrl}`,
        ...organizations.map((organization) => `--@${organization}:registry=${registryUrl}`),
        `--//${registryUrl.replace(/^https?:\/\//, '')}/:_authToken=fake`
      ],
      env: {}
    }),
    displayName: 'npm'
  },
  [PackageManager.Pnpm]: {
    command: 'pnpm',
    lockFile: 'pnpm-lock.yaml',
    // pnpm accepts the npm style scoped flag directly, with no `--config.` prefix
    getRegistryOverrideCliOptions: (registryUrl, organizations) => ({
      args: [
        `--registry=${registryUrl}`,
        ...organizations.map((organization) => `--@${organization}:registry=${registryUrl}`),
        `--//${registryUrl.replace(/^https?:\/\//, '')}/:_authToken=fake`
      ],
      env: {}
    }),
    displayName: 'pnpm'
  },
  [PackageManager.Yarn]: {
    command: 'yarn',
    lockFile: 'yarn.lock',
    // Yarn Classic silently ignores `--@<org>:registry` and ranks environment
    // variables above a project `.npmrc`, so scopes have to go through the env
    getRegistryOverrideCliOptions: (registryUrl, organizations) => ({
      args: [`--registry=${registryUrl}`],
      env: Object.fromEntries(
        organizations.map((organization) => [`npm_config_@${organization}:registry`, registryUrl])
      )
    }),
    displayName: 'Yarn Classic'
  },
  [PackageManager.Yarn4]: {
    command: 'yarn',
    lockFile: 'yarn.lock',
    // Yarn Berry ignores `.npmrc` entirely, and refuses plain http registries
    // whose hostname is not whitelisted
    getRegistryOverrideCliOptions: (registryUrl) => ({
      args: [],
      env: {
        YARN_NPM_REGISTRY_SERVER: registryUrl,
        YARN_UNSAFE_HTTP_WHITELIST: registryUrl.replace(/^https?:\/\//, '').replace(/[:/].*$/, '')
      }
    }),
    displayName: 'Yarn Berry'
  }
};
