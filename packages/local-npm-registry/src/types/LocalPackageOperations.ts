/**
 * The shapes a command derives from the local package store while it runs.
 * Nothing here is stored: the store holds what each directory published, and
 * these hold the work a command does with it.
 */

import type { PublishedPackage } from './LocalPackageStore.js';

/**
 * One package a publish covers, along with the locally published packages it
 * depends on, whose specifiers have to be pinned before it is packed.
 */
export type PackageToPublish = PublishedPackage & {
  dependencies: PublishedPackage[];
};

/**
 * One {@link PublishedPackage} as the publish graph holds it, which is the
 * package itself along with the edges it takes part in.
 */
export type PackageNode = {
  publishedPackage: PublishedPackage;
  /** Keys of the nodes this one declares as dependencies */
  dependencyKeys: Set<string>;
  /** Keys of the nodes that declare this one as a dependency */
  dependentKeys: Set<string>;
  /** Whether any project subscribes to this node */
  hasSubscribers: boolean;
};

/**
 * What one publishing directory's package.json is put back to once its tarball
 * is packed. A subscribing project keeps what it is pointed at, so nothing
 * restores one.
 */
export type PinnedPublishedPackageJson = {
  packagePath: string;
  /** The version field to write back for the package.json itself */
  versionField: string;
  /** The specifier to write back for each dependency that was pinned */
  dependencySpecifiers: Map<string, string>;
};

/**
 * One package as it is published from one directory, along with the version it
 * went out under.
 */
export type PublishedPackageAndVersion = PublishedPackage & {
  /** The version the package was published under */
  publishedVersion: string;
};

/**
 * The version each project has to declare for a package, keyed by the
 * `PackageSubscriber.subscriberPath` of the project and then by the name of the
 * package.
 *
 * ```json
 * {
 *   "/home/someone/dev/some-project": {
 *     "@some-org/some-package": "1.2.3-pa1b2c3d4.20250528123456789",
 *     "@some-org/another-package": "^2.0.0"
 *   },
 *   "/home/someone/dev/another-project": {
 *     "@some-org/some-package": "1.2.3-pa1b2c3d4.20250528123456789"
 *   }
 * }
 * ```
 */
export type VersionsBySubscriberPath = Map<string, Map<string, string>>;
