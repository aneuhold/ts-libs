/**
 * Configuration for watching packages in the monorepo.
 */
export type WatchConfig = {
  /**
   * Package names to watch for changes.
   */
  watchedPackages?: string[];

  /**
   * The port for the local Verdaccio registry.
   *
   * @default 4873
   */
  registryPort?: number;

  /**
   * The registry URL.
   *
   * @default 'http://localhost:4873'
   */
  registryUrl?: string;

  /**
   * Additional Verdaccio configuration overrides.
   */
  verdaccioConfig?: Record<string, unknown>;
};

/**
 * Information about a published package version.
 */
export type PublishedPackageInfo = {
  name: string;
  version: string;
  publishedAt: Date;
  buildPath?: string;
};
