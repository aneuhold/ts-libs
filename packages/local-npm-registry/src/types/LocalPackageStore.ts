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

/**
 * Type guard that checks whether an unknown value is a {@link LocalPackageStore}
 * of a given version, validating every entry it holds rather than only its
 * outermost shape.
 *
 * @param value - The value to narrow
 * @param version - The store version the value has to declare
 */
export const isLocalPackageStore = (
  value: unknown,
  version: number
): value is LocalPackageStore => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('version' in value) || value.version !== version) {
    return false;
  }
  if (!('packages' in value) || typeof value.packages !== 'object' || value.packages === null) {
    return false;
  }
  const pathEntriesByName: unknown[] = Object.values(value.packages);

  return pathEntriesByName.every((pathEntries) => isPackagePathEntries(pathEntries));
};

/**
 * Type guard that checks whether an unknown value has the shape of
 * {@link PackagePathEntries}.
 *
 * @param value - The value to narrow
 */
const isPackagePathEntries = (value: unknown): value is PackagePathEntries => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entries: unknown[] = Object.values(value);
  return entries.every((entry) => isPackageEntry(entry));
};

/**
 * Type guard that checks whether an unknown value has the shape of a
 * {@link PackageEntry}.
 *
 * @param value - The value to narrow
 */
const isPackageEntry = (value: unknown): value is PackageEntry => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('originalVersion' in value) || typeof value.originalVersion !== 'string') {
    return false;
  }
  if (!('currentVersion' in value) || typeof value.currentVersion !== 'string') {
    return false;
  }
  if (
    'publishArgs' in value &&
    value.publishArgs !== undefined &&
    !isStringArray(value.publishArgs)
  ) {
    return false;
  }
  if (!('subscribers' in value) || !Array.isArray(value.subscribers)) {
    return false;
  }
  return value.subscribers.every((subscriber) => isPackageSubscriber(subscriber));
};

/**
 * Type guard that checks whether an unknown value has the shape of a
 * {@link PackageSubscriber}.
 *
 * @param value - The value to narrow
 */
const isPackageSubscriber = (value: unknown): value is PackageSubscriber => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    'subscriberPath' in value &&
    typeof value.subscriberPath === 'string' &&
    'originalSpecifier' in value &&
    typeof value.originalSpecifier === 'string'
  );
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
