import ErrorUtils from '../../utils/ErrorUtils.js';
import { DR } from '../DependencyRegistry.js';
import ChangelogFileService from './ChangelogFileService.js';
import ChangelogGenerator from './ChangelogGenerator.js';
import ChangelogParser from './ChangelogParser.js';
import ChangelogValidator from './ChangelogValidator.js';
import GitTagService from './GitTagService.js';
import RepositoryInfoService from './RepositoryInfoService.js';
import { CHANGELOG_FILENAME, type ChangelogVersionEntry } from './types.js';

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

    DR.logger.info(`Validating changelog for version ${version}...`);

    const changelogExists = await ChangelogFileService.changelogExists(packagePath);
    if (!changelogExists) {
      throw new Error(
        `No ${CHANGELOG_FILENAME} file found in ${workingDir}. ` +
          `Run changelog initialization to create one.`
      );
    }

    try {
      const changelogContent = await ChangelogFileService.readChangelog(packagePath);
      const versionEntries = ChangelogParser.parseChangelog(changelogContent);

      const versionEntry = versionEntries.find((entry) => entry.version === version);

      if (!versionEntry) {
        throw new Error(
          `No changelog entry found for version ${version}. ` +
            `Please add an entry to ${CHANGELOG_FILENAME} before publishing.`
        );
      }

      ChangelogValidator.validateVersionEntry(versionEntry, version);

      DR.logger.success(`Changelog validation passed for version ${version}`);
    } catch (error) {
      const errorString = ErrorUtils.getErrorString(error);
      DR.logger.error(`Changelog validation failed: ${errorString}`);
      throw error;
    }
  }

  /**
   * Initializes a changelog file for the current package if one doesn't exist.
   * If a changelog already exists, validates it against existing Git tags and
   * updates the most recent entry if needed to match the current version.
   *
   * @param version The current version for the changelog
   * @param packageName The name of the package
   * @param packagePath Optional path to the package directory (defaults to current working directory)
   */
  static async initializeChangelog(
    version: string,
    packageName: string,
    packagePath?: string
  ): Promise<void> {
    const workingDir = packagePath || process.cwd();

    DR.logger.info(`Initializing changelog for ${packageName} version ${version}...`);

    const changelogExists = await ChangelogFileService.changelogExists(packagePath);

    if (changelogExists) {
      // If it exists, validate against Git tags and update if necessary
      const existingContent = await ChangelogFileService.readChangelog(packagePath);
      await this.validateAndUpdateExistingChangelog(
        version,
        packageName,
        existingContent,
        workingDir
      );
    } else {
      // Changelog doesn't exist, create a new one
      DR.logger.info(`Creating new changelog file`);
      const repositoryInfo = await RepositoryInfoService.getRepositoryInfo(workingDir);
      const initialContent = ChangelogGenerator.createInitialChangelogContent(
        version,
        packageName,
        repositoryInfo
      );
      await ChangelogFileService.createChangelog(initialContent, packagePath);
    }

    DR.logger.success(`Changelog initialization completed for ${packageName}`);
  }

  /**
   * Validates an existing changelog against Git tags and updates if necessary.
   *
   * @param currentVersion The current version
   * @param packageName The package name
   * @param existingContent The current changelog content
   * @param workingDir The working directory
   */
  private static async validateAndUpdateExistingChangelog(
    currentVersion: string,
    packageName: string,
    existingContent: string,
    workingDir: string
  ): Promise<void> {
    const versionEntries = ChangelogParser.parseChangelog(existingContent);

    if (versionEntries.length === 0) {
      // No version entries exist, add the current version
      DR.logger.info(
        `Changelog exists but has no version entries - adding entry for ${currentVersion}`
      );
      await this.addVersionEntry(currentVersion, existingContent, packageName, workingDir);
      return;
    }

    // Get existing Git tags for this package
    const existingTags = GitTagService.getPackageTags(packageName, workingDir);

    // Check which entries have corresponding tags and remove ones that don't (except most recent)
    const mostRecentEntry = versionEntries[0];
    const olderEntries = versionEntries.slice(1);
    const validOlderEntries: ChangelogVersionEntry[] = [];
    const removedVersions: string[] = [];

    for (const entry of olderEntries) {
      const expectedTag = GitTagService.getTagName(packageName, entry.version);
      if (existingTags.includes(expectedTag)) {
        validOlderEntries.push(entry);
      } else {
        removedVersions.push(entry.version);
      }
    }

    // If we removed any older entries, we need to regenerate the changelog
    if (removedVersions.length > 0) {
      DR.logger.info(
        `Removing changelog entries without corresponding Git tags: ${removedVersions.join(', ')}`
      );

      const validEntries = [mostRecentEntry, ...validOlderEntries];
      const repositoryInfo = await RepositoryInfoService.getRepositoryInfo(workingDir);
      const updatedContent = ChangelogGenerator.regenerateChangelogContent(
        validEntries,
        packageName,
        repositoryInfo
      );
      await ChangelogFileService.writeChangelog(updatedContent, workingDir);
    }

    // Now handle the most recent entry
    const mostRecentTag = GitTagService.getTagName(packageName, mostRecentEntry.version);
    const hasTagForMostRecent = existingTags.includes(mostRecentTag);

    if (hasTagForMostRecent) {
      // Most recent entry has a tag, so we need to add a new entry for current version
      if (mostRecentEntry.version === currentVersion) {
        DR.logger.info(
          `Changelog already contains entry for version ${currentVersion} with corresponding tag - no changes made`
        );
        return;
      }

      DR.logger.info(
        `Most recent changelog entry has a tag - adding new entry for version ${currentVersion}`
      );
      await this.addVersionEntry(currentVersion, existingContent, packageName, workingDir);
    } else {
      // Most recent entry doesn't have a tag
      if (mostRecentEntry.version === currentVersion) {
        DR.logger.info(
          `Changelog already contains entry for version ${currentVersion} without tag - no changes made`
        );
        return;
      }

      // Update the most recent entry to match current version
      DR.logger.info(
        `Updating most recent changelog entry from ${mostRecentEntry.version} to ${currentVersion}`
      );
      await this.updateMostRecentVersionEntry(
        currentVersion,
        existingContent,
        packageName,
        workingDir
      );
    }
  }

  /**
   * Updates the most recent version entry in the changelog.
   *
   * @param newVersion The new version to update to
   * @param existingContent The current changelog content
   * @param packageName The package name
   * @param workingDir The working directory
   */
  private static async updateMostRecentVersionEntry(
    newVersion: string,
    existingContent: string,
    packageName: string,
    workingDir: string
  ): Promise<void> {
    const versionEntries = ChangelogParser.parseChangelog(existingContent);

    if (versionEntries.length === 0) {
      throw new Error('No version entries found to update');
    }

    const mostRecentEntry = versionEntries[0];
    const oldVersionPattern = `## 🔖 [${mostRecentEntry.version}]`;
    const newVersionPattern = `## 🔖 [${newVersion}]`;

    // Replace the version in the changelog content
    let updatedContent = existingContent.replace(oldVersionPattern, newVersionPattern);

    // Update version links if they exist
    const repositoryInfo = await RepositoryInfoService.getRepositoryInfo(workingDir);
    if (repositoryInfo) {
      updatedContent = ChangelogGenerator.addVersionLinksToChangelog(
        updatedContent,
        repositoryInfo,
        packageName
      );
    }

    await ChangelogFileService.writeChangelog(updatedContent, workingDir);
  }

  /**
   * Adds a new version entry to an existing changelog.
   *
   * @param version The version to add
   * @param existingContent The current changelog content
   * @param packageName The package name for generating version links
   * @param packagePath The package directory path
   */
  private static async addVersionEntry(
    version: string,
    existingContent: string,
    packageName: string,
    packagePath: string
  ): Promise<void> {
    const currentDate = ChangelogGenerator.getCurrentDate();
    const versionEntry = ChangelogGenerator.createVersionEntryContent(version, currentDate);

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
    const repositoryInfo = await RepositoryInfoService.getRepositoryInfo(packagePath);
    if (repositoryInfo) {
      newContent = ChangelogGenerator.addVersionLinksToChangelog(
        newContent,
        repositoryInfo,
        packageName
      );
    }

    await ChangelogFileService.writeChangelog(newContent, packagePath);
  }

  /**
   * Extracts changelog content for a specific version to use in release notes.
   *
   * @param version The version to extract changelog content for
   * @param packagePath Optional path to the package directory (defaults to current working directory)
   * @returns Formatted release notes content for the version
   * @throws Error if changelog doesn't exist or version entry is not found
   */
  static async getChangelogContentForVersion(
    version: string,
    packagePath?: string
  ): Promise<string> {
    const workingDir = packagePath || process.cwd();

    DR.logger.info(`Extracting changelog content for version ${version}...`);

    const changelogExists = await ChangelogFileService.changelogExists(packagePath);
    if (!changelogExists) {
      throw new Error(
        `No ${CHANGELOG_FILENAME} file found in ${workingDir}. ` +
          `Cannot extract changelog content for version ${version}.`
      );
    }

    try {
      const changelogContent = await ChangelogFileService.readChangelog(packagePath);
      const versionEntries = ChangelogParser.parseChangelog(changelogContent);

      const versionEntry = versionEntries.find((entry) => entry.version === version);

      if (!versionEntry) {
        throw new Error(
          `No changelog entry found for version ${version}. ` +
            `Available versions: ${versionEntries.map((entry) => entry.version).join(', ')}`
        );
      }

      // Build the release notes content
      const releaseNotesSections: string[] = [];

      for (const section of versionEntry.sections) {
        if (section.content && section.content.trim()) {
          releaseNotesSections.push(`## ${section.type}\n\n${section.content.trim()}`);
        }
      }

      if (releaseNotesSections.length === 0) {
        return `Release notes for ${version} - See CHANGELOG.md for details.`;
      }

      const releaseNotesContent = releaseNotesSections.join('\n\n');

      DR.logger.success(`Successfully extracted changelog content for version ${version}`);

      return releaseNotesContent;
    } catch (error) {
      const errorString = ErrorUtils.getErrorString(error);
      DR.logger.error(`Failed to extract changelog content: ${errorString}`);
      throw error;
    }
  }
}
