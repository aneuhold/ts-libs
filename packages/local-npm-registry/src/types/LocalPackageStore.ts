/**
 * The structure of the local package store file.
 *
 * Maintains a registry of all locally published packages and their
 * associated metadata in a JSON file stored in the user's home directory.
 */
export type LocalPackageStore = {
  /** The shape of the store, which every reader has to agree on */
  version: number;
  /** Map of package names to the directories they are published from */
  packages: {
    [packageName: string]: PackagePathEntries | undefined;
  };
};

/**
 * The directories a single package is published from, keyed by the absolute
 * path of the package.
 */
export type PackagePathEntries = {
  [packagePath: string]: PackageEntry | undefined;
};

/**
 * Everything known about a package published from one directory.
 */
export type PackageEntry = {
  /** The original version from package.json before timestamp modifications */
  originalVersion: string;
  /** The current version with timestamp suffix */
  currentVersion: string;
  /** List of subscribers to this package */
  subscribers: PackageSubscriber[];
  /** Additional arguments that were used when publishing this package */
  publishArgs?: string[];
};

/**
 * Represents a project that subscribes to a local package.
 *
 * Tracks the subscriber's location and their original version requirement
 * for the package, enabling proper restoration when unsubscribing.
 */
export type PackageSubscriber = {
  /** The absolute path to the project directory that subscribes to this package */
  subscriberPath: string;
  /** The original version specifier that existed for the package in the subscriber's dependencies */
  originalSpecifier: string;
};
