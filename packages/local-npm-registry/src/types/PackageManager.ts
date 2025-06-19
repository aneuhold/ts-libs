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
  /** Configuration file name used for registry settings */
  configFile: string;
  /** Configuration format/content template for registry settings */
  configFormat: (registryUrl: string) => string;
  /** Display name for user-facing messages */
  displayName: string;
};

/**
 * Static constant map containing information for each package manager.
 * This serves as the single source of truth for package manager details.
 */
export const PACKAGE_MANAGER_INFO: Record<PackageManager, PackageManagerInfo> = {
  [PackageManager.Npm]: {
    command: 'npm',
    lockFile: 'package-lock.json',
    configFile: '.npmrc',
    configFormat: (registryUrl: string) => `registry=${registryUrl}\n`,
    displayName: 'npm'
  },
  [PackageManager.Pnpm]: {
    command: 'pnpm',
    lockFile: 'pnpm-lock.yaml',
    configFile: '.npmrc',
    configFormat: (registryUrl: string) => `registry=${registryUrl}\n`,
    displayName: 'pnpm'
  },
  [PackageManager.Yarn]: {
    command: 'yarn',
    lockFile: 'yarn.lock',
    configFile: '.npmrc',
    configFormat: (registryUrl: string) => `registry=${registryUrl}\n`,
    displayName: 'Yarn Classic'
  },
  [PackageManager.Yarn4]: {
    command: 'yarn',
    lockFile: 'yarn.lock',
    configFile: '.yarnrc.yml',
    configFormat: (registryUrl: string) =>
      `npmRegistryServer: ${registryUrl}\nunsafeHttpWhitelist: ['localhost']\n`,
    displayName: 'Yarn Berry'
  }
};
