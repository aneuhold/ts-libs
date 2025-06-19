import { access, readFile, writeFile } from 'fs/promises';
import path from 'path';
import ErrorUtils from '../utils/ErrorUtils.js';
import { DR } from './DependencyRegistry.js';

const CHANGELOG_FILENAME = 'CHANGELOG.md';
const REQUIRED_SECTION_TYPES = ['✅ Added', '🏗️ Changed', '🩹 Fixed', '🔥 Removed'] as const;

type ChangelogSectionType = (typeof REQUIRED_SECTION_TYPES)[number];

/**
 * Repository information for generating version links.
 */
interface RepositoryInfo {
  owner: string;
  repo: string;
  url: string;
}

/**
 * Represents a section within a changelog version entry.
 */
interface ChangelogSection {
  type: ChangelogSectionType;
  content: string;
}

/**
 * Represents a version entry in a changelog.
 */
interface ChangelogVersionEntry {
  version: string;
  date: string;
  sections: ChangelogSection[];
}

/**
 * A service for managing and validating changelog files in packages.
 *
 * This service handles the creation, validation, and maintenance of CHANGELOG.md
 * files following the Keep a Changelog format.
 */
export default class ChangelogService {
  /**
   * Validates that a changelog exists and contains a valid entry for the specified version.
   *
   * @param version The version to validate in the changelog
   * @param packagePath Optional path to the package directory (defaults to current working directory)
   * @throws Error if validation fails
   */
  static async validateChangelogForVersion(version: string, packagePath?: string): Promise<void> {
    const workingDir = packagePath || process.cwd();
    const changelogPath = path.join(workingDir, CHANGELOG_FILENAME);

    DR.logger.info(`Validating changelog for version ${version}...`);

    try {
      await access(changelogPath);
    } catch {
      throw new Error(
        `No ${CHANGELOG_FILENAME} file found in ${workingDir}. ` +
          `Run changelog initialization to create one.`
      );
    }

    try {
      const changelogContent = await readFile(changelogPath, 'utf-8');
      const versionEntries = this.parseChangelog(changelogContent);

      const versionEntry = versionEntries.find((entry) => entry.version === version);

      if (!versionEntry) {
        throw new Error(
          `No changelog entry found for version ${version}. ` +
            `Please add an entry to ${CHANGELOG_FILENAME} before publishing.`
        );
      }

      this.validateVersionEntry(versionEntry, version);

      DR.logger.success(`Changelog validation passed for version ${version}`);
    } catch (error) {
      const errorString = ErrorUtils.getErrorString(error);
      DR.logger.error(`Changelog validation failed: ${errorString}`);
      throw error;
    }
  }

  /**
   * Initializes a changelog file for the current package if one doesn't exist.
   * If a changelog already exists, this operation is idempotent and will not
   * modify existing content.
   *
   * @param version The initial version for the changelog
   * @param packageName The name of the package
   * @param packagePath Optional path to the package directory (defaults to current working directory)
   */
  static async initializeChangelog(
    version: string,
    packageName: string,
    packagePath?: string
  ): Promise<void> {
    const workingDir = packagePath || process.cwd();
    const changelogPath = path.join(workingDir, CHANGELOG_FILENAME);

    DR.logger.info(`Initializing changelog for ${packageName} version ${version}...`);

    try {
      // Check if changelog already exists
      await access(changelogPath);

      // If it exists, check if it already has content for this version
      const existingContent = await readFile(changelogPath, 'utf-8');
      const versionEntries = this.parseChangelog(existingContent);

      if (versionEntries.some((entry) => entry.version === version)) {
        DR.logger.info(`Changelog already contains entry for version ${version} - no changes made`);
        return;
      }

      DR.logger.info(`Changelog exists but missing entry for version ${version} - adding entry`);
      await this.addVersionEntry(changelogPath, version, existingContent, packageName, workingDir);
    } catch {
      // Changelog doesn't exist, create a new one
      DR.logger.info(`Creating new changelog file: ${changelogPath}`);
      const initialContent = await this.createInitialChangelogContent(
        version,
        packageName,
        workingDir
      );
      await writeFile(changelogPath, initialContent);
    }

    DR.logger.success(`Changelog initialization completed for ${packageName}`);
  }

  /**
   * Adds a new version entry to an existing changelog.
   *
   * @param changelogPath Path to the changelog file
   * @param version The version to add
   * @param existingContent The current changelog content
   * @param packageName The package name for generating version links
   * @param packagePath The package directory path
   */
  private static async addVersionEntry(
    changelogPath: string,
    version: string,
    existingContent: string,
    packageName: string,
    packagePath: string
  ): Promise<void> {
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const versionEntry = this.createVersionEntryContent(version, currentDate);

    // Find the position after the header to insert the new version
    const lines = existingContent.split('\n');
    const headerEndIndex = lines.findIndex((line) => line.startsWith('## ') && line.includes('['));

    let newContent: string;
    if (headerEndIndex === -1) {
      // No existing version entries, add after the header
      const headerLines = lines.slice(0, lines.findIndex((line) => line.trim() === '') + 1);
      newContent = [...headerLines, '', versionEntry, '', ...lines.slice(headerLines.length)].join(
        '\n'
      );
    } else {
      // Insert before the first existing version
      newContent = [
        ...lines.slice(0, headerEndIndex),
        versionEntry,
        '',
        ...lines.slice(headerEndIndex)
      ].join('\n');
    }

    // Add version links if repository info is available
    const repositoryInfo = await this.getRepositoryInfo(packagePath);
    if (repositoryInfo) {
      newContent = this.addVersionLinksToChangelog(newContent, repositoryInfo, packageName);
    }

    await writeFile(changelogPath, newContent);
  }

  /**
   * Creates the initial changelog content with header and first version entry.
   *
   * @param version The initial version
   * @param packageName The package name for generating version links
   * @param packagePath The package directory path
   * @returns The complete changelog content
   */
  private static async createInitialChangelogContent(
    version: string,
    packageName: string,
    packagePath: string
  ): Promise<string> {
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    let content = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

${this.createVersionEntryContent(version, currentDate)}
`;

    // Add version links if repository info is available
    const repositoryInfo = await this.getRepositoryInfo(packagePath);
    if (repositoryInfo) {
      content = this.addVersionLinksToChangelog(content, repositoryInfo, packageName);
    }

    return content;
  }

  /**
   * Creates the content for a version entry.
   *
   * @param version The version number
   * @param date The date in YYYY-MM-DD format
   * @returns The version entry content
   */
  private static createVersionEntryContent(version: string, date: string): string {
    return `## 🔖 [${version}] (${date})

### ✅ Added

### 🏗️ Changed

### 🩹 Fixed

### 🔥 Removed`;
  }

  /**
   * Parses a changelog file content and extracts version entries.
   *
   * @param content The changelog file content
   * @returns Array of parsed version entries
   */
  private static parseChangelog(content: string): ChangelogVersionEntry[] {
    const versionEntries: ChangelogVersionEntry[] = [];

    // Split by ## to get version sections
    const sections = content.split(/^## /m).filter((section) => section.trim());

    for (const section of sections) {
      const lines = section.split('\n');
      const headerLine = lines[0];

      // Extract version from header like "🔖 [1.0.0] (2025-06-19)" or "[1.0.0] (2025-06-19)"
      const versionMatch = headerLine.match(/(?:🔖\s*)?\[([^\]]+)\]\s*\(([^)]+)\)/);
      if (!versionMatch) continue;

      const [, version, date] = versionMatch;
      const sectionContent = lines.slice(1).join('\n');

      // Parse sections within the version entry
      const parsedSections = this.parseVersionSections(sectionContent);

      versionEntries.push({
        version,
        date,
        sections: parsedSections
      });
    }

    return versionEntries;
  }

  /**
   * Parses the sections within a version entry.
   *
   * @param content The content of a version entry
   * @returns Array of parsed sections
   */
  private static parseVersionSections(content: string): ChangelogSection[] {
    const sections: ChangelogSection[] = [];

    // Split by ### to get individual sections
    const sectionParts = content.split(/^### /m).filter((part) => part.trim());

    for (const part of sectionParts) {
      const lines = part.split('\n');
      const sectionType = lines[0].trim() as ChangelogSectionType;

      if (REQUIRED_SECTION_TYPES.includes(sectionType)) {
        const sectionContent = lines.slice(1).join('\n').trim();
        sections.push({
          type: sectionType,
          content: sectionContent
        });
      }
    }

    return sections;
  }

  /**
   * Validates that a version entry meets the requirements.
   *
   * @param versionEntry The version entry to validate
   * @param version The version being validated (for error messages)
   * @throws Error if validation fails
   */
  private static validateVersionEntry(versionEntry: ChangelogVersionEntry, version: string): void {
    const { sections } = versionEntry;

    if (sections.length === 0) {
      throw new Error(
        `Version ${version} has no changelog sections. ` +
          `At least one of the following sections is required: ${REQUIRED_SECTION_TYPES.join(', ')}`
      );
    }

    let hasValidSection = false;
    const emptySections: string[] = [];

    for (const section of sections) {
      if (REQUIRED_SECTION_TYPES.includes(section.type)) {
        if (section.content && section.content.trim().length > 0) {
          hasValidSection = true;
        } else {
          // Section exists but is empty
          emptySections.push(section.type);
        }
      }
    }

    // Fail if any section exists but is empty
    if (emptySections.length > 0) {
      throw new Error(
        `Version ${version} has empty changelog sections. ` +
          `The following sections exist but have no content: ${emptySections.join(', ')}`
      );
    }

    // Fail if no section has meaningful content
    if (!hasValidSection) {
      throw new Error(
        `Version ${version} has no meaningful content in changelog sections. ` +
          `At least one of the following sections must have content: ${REQUIRED_SECTION_TYPES.join(', ')}`
      );
    }
  }

  /**
   * Extracts repository information from package.json
   *
   * @param packagePath Path to the package directory
   */
  private static async getRepositoryInfo(packagePath?: string): Promise<RepositoryInfo | null> {
    const workingDir = packagePath || process.cwd();
    const packageJsonPath = path.join(workingDir, 'package.json');

    try {
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent) as unknown;

      // Type guard to check if packageJson has the expected structure
      if (
        typeof packageJson !== 'object' ||
        packageJson === null ||
        !('repository' in packageJson) ||
        typeof packageJson.repository !== 'object' ||
        packageJson.repository === null ||
        !('url' in packageJson.repository) ||
        typeof packageJson.repository.url !== 'string'
      ) {
        return null;
      }

      const url = packageJson.repository.url;

      // Handle different URL formats
      let gitUrl = url;
      if (gitUrl.startsWith('git+')) {
        gitUrl = gitUrl.substring(4);
      }
      if (gitUrl.endsWith('.git')) {
        gitUrl = gitUrl.substring(0, gitUrl.length - 4);
      }

      // Extract owner and repo from GitHub URL
      const match = gitUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
      if (!match) {
        return null;
      }

      const [, owner, repo] = match;

      return {
        owner,
        repo,
        url: `https://github.com/${owner}/${repo}`
      };
    } catch {
      return null;
    }
  }

  /**
   * Generates a GitHub compare URL for version links in monorepo changelog
   *
   * @param repositoryInfo Repository information
   * @param packageName Name of the package (used for tag prefix)
   * @param currentVersion Current version
   * @param previousVersion Previous version (optional)
   */
  private static generateVersionLink(
    repositoryInfo: RepositoryInfo,
    packageName: string,
    currentVersion: string,
    previousVersion?: string
  ): string {
    // Convert package name to tag prefix (remove scope if present)
    const tagPrefix = packageName.replace(/^@[\w-]+\//, '');

    const currentTag = `${tagPrefix}-v${currentVersion}`;

    if (!previousVersion) {
      // For first version, link to the tag itself
      return `${repositoryInfo.url}/releases/tag/${currentTag}`;
    }

    const previousTag = `${tagPrefix}-v${previousVersion}`;
    return `${repositoryInfo.url}/compare/${previousTag}...${currentTag}`;
  }

  /**
   * Updates changelog content to include version links at the bottom
   *
   * @param content Original changelog content
   * @param repositoryInfo Repository information
   * @param packageName Package name for generating tags
   */
  private static addVersionLinksToChangelog(
    content: string,
    repositoryInfo: RepositoryInfo,
    packageName: string
  ): string {
    const versionEntries = this.parseChangelog(content);

    if (versionEntries.length === 0) {
      return content;
    }

    // Generate link references
    const linkReferences: string[] = [];

    for (let i = 0; i < versionEntries.length; i++) {
      const currentEntry = versionEntries[i];
      const previousEntry = i + 1 < versionEntries.length ? versionEntries[i + 1] : undefined;

      const versionLink = this.generateVersionLink(
        repositoryInfo,
        packageName,
        currentEntry.version,
        previousEntry?.version
      );

      linkReferences.push(`[${currentEntry.version}]: ${versionLink}`);
    }

    // Check if content already has link references section
    const linkSectionMatch = content.match(/\n\n<!-- Link References -->\n([\s\S]*?)$/);

    if (linkSectionMatch) {
      // Replace existing link references
      const newLinkSection = `\n\n<!-- Link References -->\n${linkReferences.join('\n')}\n`;
      return content.replace(linkSectionMatch[0], newLinkSection);
    } else {
      // Add new link references section
      const newLinkSection = `\n\n<!-- Link References -->\n${linkReferences.join('\n')}\n`;
      return content + newLinkSection;
    }
  }
}
