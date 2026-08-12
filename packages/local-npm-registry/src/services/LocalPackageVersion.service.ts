import { createHash } from 'crypto';

/**
 * Service for the versions this tool publishes under, which carry the directory
 * they were published from and the moment they were published.
 */
export class LocalPackageVersionService {
  /**
   * Matches the slug of any publishing directory.
   */
  static readonly #ANY_PATH_SLUG_REGEX = /p[0-9a-f]{8}/;

  /**
   * Matches a millisecond precision timestamp.
   */
  static readonly #TIMESTAMP_REGEX = /\d{17}/;

  /**
   * Generates the version a package is published under, replacing any suffix
   * the original version already carries.
   *
   * @param originalVersion - The original version string, which may already carry a suffix
   * @param packagePath - Resolved absolute path of the package being published
   */
  static generateTimestampVersion(originalVersion: string, packagePath: string): string {
    const suffix = `-${this.getPathSlug(packagePath)}.${this.getTimestamp()}`;
    const anySuffixRegex = this.#buildSuffixRegex(this.#ANY_PATH_SLUG_REGEX, true);

    if (anySuffixRegex.test(originalVersion)) {
      return originalVersion.replace(anySuffixRegex, suffix);
    }

    return `${originalVersion}${suffix}`;
  }

  /**
   * The fixed width slug that every version published from a directory carries,
   * which is what identifies one directory's versions among the versions of a
   * package several directories publish.
   *
   * The directory is hashed down because a version cannot hold a whole path,
   * which keeps two directories publishing the same package from landing on the
   * same version.
   *
   * The `p` prefix is what keeps the version publishable. Semver forbids a
   * leading zero in an all numeric prerelease identifier, and a bare hex slug
   * lands on one often enough to matter, so `p` holds the identifier
   * alphanumeric.
   *
   * @param packagePath - Resolved absolute path of the package being published
   */
  static getPathSlug(packagePath: string): string {
    return `p${createHash('sha256').update(packagePath).digest('hex').slice(0, 8)}`;
  }

  /**
   * The current time as a millisecond precision timestamp. Shared because it is used in a few
   * spots and it is nice to be consistent for this library.
   */
  static getTimestamp(): string {
    return new Date()
      .toISOString()
      .replace(/[-:T.]/g, '')
      .slice(0, 17);
  }

  /**
   * Whether a version string is one generated for a package published from a
   * given directory.
   *
   * @param version - The version string to check
   * @param packagePath - Resolved absolute path of the package
   */
  static versionStringIsForLocalPackage(version: string, packagePath: string): boolean {
    return this.#buildSuffixRegex(new RegExp(this.getPathSlug(packagePath)), true).test(version);
  }

  /**
   * Matches the suffix that versions published from a given directory carry,
   * unanchored, so a caller can match it inside a longer string.
   *
   * @param packagePath - Resolved absolute path of the package
   */
  static getSuffixRegex(packagePath: string): RegExp {
    return this.#buildSuffixRegex(new RegExp(this.getPathSlug(packagePath)), false);
  }

  /**
   * Builds the suffix regex around whatever matches the path slug.
   *
   * @param pathSlugRegex - Matches the slug of one directory or of any
   * @param endAnchored - Whether the suffix has to end the string it is matched against
   */
  static #buildSuffixRegex(pathSlugRegex: RegExp, endAnchored: boolean): RegExp {
    return new RegExp(
      `-${pathSlugRegex.source}\\.${this.#TIMESTAMP_REGEX.source}${endAnchored ? '$' : ''}`
    );
  }
}
