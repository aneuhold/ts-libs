import {
  DR,
  isPackageJson,
  isPackageJsonWithoutVersion,
  type PackageJson,
  type PackageJsonWithoutVersion
} from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { LocalPackageVersionService } from './LocalPackageVersion.service.js';

/**
 * Service for managing package.json files.
 */
export class PackageJsonService {
  /**
   * Matches a `version` key and the value it holds. Group 1 is the key and the
   * spacing that leads to the value, which a rewrite puts back as it was, and
   * group 2 is the value on its own, which is what the top-level key is told
   * apart by.
   */
  static readonly #VERSION_PROPERTY_REGEX = /("version"\s*:\s*")([^"]*)(?=")/g;

  /**
   * Matches a section that declares dependencies, up to the brace that closes
   * it. Group 1 is the key and the brace it opens, group 2 everything the
   * section declares, which holds no brace of its own since a section holds
   * only strings.
   */
  static readonly #DEPENDENCY_SECTION_REGEX =
    /("(?:dependencies|devDependencies|peerDependencies)"\s*:\s*\{)([^}]*)/g;

  /**
   * Matches one `"package": "specifier"` declaration. Group 1 is the package
   * and the spacing that leads to the specifier, group 2 the package name on
   * its own, which is what a specifier is looked up by. The specifier is left
   * uncaptured, since a rewrite overwrites it rather than reading it.
   */
  static readonly #SPECIFIER_PROPERTY_REGEX = /("([^"]+)"\s*:\s*")[^"]*(?=")/g;

  /**
   * Reads and validates the package.json file in the specified directory.
   *
   * The triple declaration of the signature must have been an experiment by Anton.
   * This is not a great idea (note written by Anton btw, just saying I should rewrite this).
   *
   * @param dir - Directory to search for package.json
   * @param requireVersion - Whether to require the version field (default: true for packages being published)
   */
  static async getPackageInfo(dir?: string, requireVersion?: true): Promise<PackageJson | null>;
  static async getPackageInfo(
    dir: string | undefined,
    requireVersion: false
  ): Promise<PackageJsonWithoutVersion | null>;
  static async getPackageInfo(
    dir: string = process.cwd(),
    requireVersion: boolean = true
  ): Promise<PackageJsonWithoutVersion | null> {
    try {
      const packageJsonPath = path.join(dir, 'package.json');
      const rawPackageJson: unknown = await fs.readJson(packageJsonPath);

      if (requireVersion) {
        if (!isPackageJson(rawPackageJson)) {
          throw new Error('package.json must contain name and version fields');
        }
        return rawPackageJson;
      }

      if (!isPackageJsonWithoutVersion(rawPackageJson)) {
        throw new Error('package.json must contain name field');
      }
      return rawPackageJson;
    } catch (error) {
      DR.logger.error(`Error reading package.json: ${String(error)}`);
      return null;
    }
  }

  /**
   * Writes a project's own version, which is the top-level `version` field of
   * its package.json rather than a `version` nested inside another object.
   *
   * @param projectPath - Path to the project directory containing package.json
   * @param version - New version to set
   */
  static async updateVersionField(projectPath: string, version: string): Promise<void> {
    const { content, packageJson } = await this.#readPackageJson(projectPath);
    let hasWritten = false;

    // What the file parsed to is what tells the top-level key apart from a
    // nested one. A nested `version` holding the same string ahead of it is
    // taken instead, which a lookbehind skipping whole nested objects would
    // rule out, at the cost of a nesting depth it cannot see past
    const updatedContent = content.replace(
      this.#VERSION_PROPERTY_REGEX,
      (match: string, keyAndSpacing: string, currentVersion: string) => {
        if (hasWritten || currentVersion !== packageJson.version) {
          return match;
        }
        hasWritten = true;
        return `${keyAndSpacing}${version}`;
      }
    );

    await this.#writePackageJson(projectPath, content, updatedContent);
  }

  /**
   * Writes a project's own version only while its package.json holds a version
   * generated for that directory, which leaves a version updated by hand alone.
   *
   * @param projectPath - Path to the project directory containing package.json
   * @param version - New version to set
   */
  static async updateVersionFieldIfLocal(projectPath: string, version: string): Promise<void> {
    const packageInfo = await this.getPackageInfo(projectPath, false);
    if (
      !packageInfo?.version ||
      !LocalPackageVersionService.versionStringIsForLocalPackage(packageInfo.version, projectPath)
    ) {
      return;
    }

    await this.updateVersionField(projectPath, version);
  }

  /**
   * Writes the specifiers a project declares for a set of packages, across
   * every dependency section that declares one of them.
   *
   * A package the project does not declare is left out rather than added, and
   * an `overrides` or `resolutions` entry naming one is left alone, since
   * neither is what the project itself asks for. A `dependencies` key nested in
   * another object, such as a pnpm package extension, is written along with the
   * project's own, which telling the two apart would cost a brace depth count.
   *
   * @param projectPath - Path to the project directory containing package.json
   * @param specifiersByPackageName - The specifier to declare each package with
   */
  static async updateDependencySpecifiers(
    projectPath: string,
    specifiersByPackageName: Map<string, string>
  ): Promise<void> {
    if (specifiersByPackageName.size === 0) {
      return;
    }

    const { content } = await this.#readPackageJson(projectPath);

    const updatedContent = content.replace(
      this.#DEPENDENCY_SECTION_REGEX,
      (match: string, keyAndOpeningBrace: string, declarations: string) =>
        `${keyAndOpeningBrace}${this.#writeDeclaredSpecifiers(declarations, specifiersByPackageName)}`
    );

    await this.#writePackageJson(projectPath, content, updatedContent);
  }

  /**
   * Gets the current version specifier a project's package.json declares for a
   * package.
   *
   * @param projectPath - Path to the project directory containing package.json
   * @param packageName - Name of the package to find the specifier for
   * @returns The current version specifier or null if not found
   */
  static async getCurrentPackageVersionSpecifier(
    projectPath: string,
    packageName: string
  ): Promise<string | null> {
    const packageInfo = await this.getPackageInfo(projectPath, false);
    if (!packageInfo) {
      return null;
    }

    // Check dependencies
    if (packageInfo.dependencies?.[packageName]) {
      return packageInfo.dependencies[packageName];
    }

    // Check devDependencies
    if (packageInfo.devDependencies?.[packageName]) {
      return packageInfo.devDependencies[packageName];
    }

    // Check peerDependencies
    if (packageInfo.peerDependencies?.[packageName]) {
      return packageInfo.peerDependencies[packageName];
    }

    return null;
  }

  /**
   * Extracts the organization name from a scoped package name.
   *
   * @param packageName The package name (e.g., "@myorg/package-name")
   * @returns The organization name or null if not a scoped package
   */
  static extractOrganizationFromPackageName(packageName: string): string | null {
    const orgMatch = packageName.match(/^@([^/]+)\//);
    return orgMatch ? orgMatch[1] : null;
  }

  /**
   * Rewrites the specifier of every declaration of one dependency section that
   * names a package the caller has a specifier for, leaving the rest of the
   * section as it sits.
   *
   * The raw text between the braces of one section, which is what
   * `declarations` holds, looks like this:
   *
   * ```
   *     "some-package": "^1.0.0",
   *     "another-package": "^2.0.0"
   * ```
   *
   * @param declarations - The raw text between the braces of one section
   * @param specifiersByPackageName - The specifier to declare each package with
   */
  static #writeDeclaredSpecifiers(
    declarations: string,
    specifiersByPackageName: Map<string, string>
  ): string {
    // Doing a single pass at all specifiers with regex is a lot more performant than making a regex
    // per package and calling replace multiple times. (Note by Anton 8/13/2026). Can validate this
    // again in the future. But for many packages this comes out ot like a 100x performance increase.
    return declarations.replace(
      this.#SPECIFIER_PROPERTY_REGEX,
      (declaration: string, packageAndSpacing: string, packageName: string) => {
        const specifier = specifiersByPackageName.get(packageName);
        return specifier === undefined ? declaration : `${packageAndSpacing}${specifier}`;
      }
    );
  }

  /**
   * Reads a project's package.json both as the text a write works against, so
   * that the file keeps the formatting it was written with, and as what that
   * text parses to, which is what a write locates its target by.
   *
   * @param projectPath - Path to the project directory containing package.json
   */
  static async #readPackageJson(
    projectPath: string
  ): Promise<{ content: string; packageJson: PackageJsonWithoutVersion }> {
    const packageJson = await this.getPackageInfo(projectPath, false);
    if (!packageJson) {
      throw new Error(`No package.json to update in ${projectPath}`);
    }

    return {
      content: await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'),
      packageJson
    };
  }

  /**
   * Writes a project's package.json back, leaving a file no rewrite reached
   * untouched.
   *
   * @param projectPath - Path to the project directory containing package.json
   * @param content - The raw text the rewrite worked against
   * @param updatedContent - The raw text the rewrite produced
   */
  static async #writePackageJson(
    projectPath: string,
    content: string,
    updatedContent: string
  ): Promise<void> {
    if (updatedContent === content) {
      return;
    }

    const packageJsonPath = path.join(projectPath, 'package.json');
    // A package manager, or Node resolving a module, can read this file at any
    // moment. Writing to it directly truncates it first, which a reader landing
    // in between sees as an empty file rather than a package.json. The
    // replacement is staged beside it so the rename that swaps it in stays on
    // one filesystem, and a reader sees either the old file or the new one.
    const stagingPath = path.join(projectPath, `package.json.${randomUUID()}.tmp`);

    try {
      await fs.writeFile(stagingPath, updatedContent, 'utf-8');
      await fs.rename(stagingPath, packageJsonPath);
    } catch (error) {
      await fs.remove(stagingPath).catch(() => {
        // The write is the failure worth reporting
      });
      throw error;
    }
  }
}
