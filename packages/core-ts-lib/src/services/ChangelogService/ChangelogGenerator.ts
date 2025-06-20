import ChangelogParser from './ChangelogParser.js';
import GitTagService from './GitTagService.js';
import type { ChangelogVersionEntry, RepositoryInfo } from './types.js';

/**
 * Service for generating changelog content and version links.
 */
export default class ChangelogGenerator {
  /**
   * Creates the content for a version entry.
   *
   * @param version The version number
   * @param date The date in YYYY-MM-DD format
   * @returns The version entry content
   */
  static createVersionEntryContent(version: string, date: string): string {
    return `## 🔖 [${version}] (${date})

### ✅ Added

### 🏗️ Changed

### 🩹 Fixed

### 🔥 Removed`;
  }

  /**
   * Creates the initial changelog content with header and first version entry.
   *
   * @param version The initial version
   * @param packageName The package name for generating version links
   * @param repositoryInfo Optional repository information for version links
   * @returns The complete changelog content
   */
  static createInitialChangelogContent(
    version: string,
    packageName: string,
    repositoryInfo?: RepositoryInfo | null
  ): string {
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    let content = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

${this.createVersionEntryContent(version, currentDate)}
`;

    // Add version links if repository info is available
    if (repositoryInfo) {
      content = this.addVersionLinksToChangelog(content, repositoryInfo, packageName);
    }

    return content;
  }

  /**
   * Generates a GitHub compare URL for version links in monorepo changelog
   *
   * @param repositoryInfo Repository information
   * @param packageName Name of the package (used for tag prefix)
   * @param currentVersion Current version
   * @param previousVersion Previous version (optional)
   * @returns The version link URL
   */
  static generateVersionLink(
    repositoryInfo: RepositoryInfo,
    packageName: string,
    currentVersion: string,
    previousVersion?: string
  ): string {
    const currentTag = GitTagService.getTagName(packageName, currentVersion);

    if (!previousVersion) {
      // For first version, link to the tag itself
      return `${repositoryInfo.url}/releases/tag/${currentTag}`;
    }

    const previousTag = GitTagService.getTagName(packageName, previousVersion);
    return `${repositoryInfo.url}/compare/${previousTag}...${currentTag}`;
  }

  /**
   * Updates changelog content to include version links at the bottom
   *
   * @param content Original changelog content
   * @param repositoryInfo Repository information
   * @param packageName Package name for generating tags
   * @returns Updated changelog content with version links
   */
  static addVersionLinksToChangelog(
    content: string,
    repositoryInfo: RepositoryInfo,
    packageName: string
  ): string {
    const versionEntries = ChangelogParser.parseChangelog(content);

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

  /**
   * Regenerates changelog content from a list of version entries.
   *
   * @param versionEntries The version entries to include
   * @param packageName The package name for generating version links
   * @param repositoryInfo Optional repository information for version links
   * @returns The regenerated changelog content
   */
  static regenerateChangelogContent(
    versionEntries: ChangelogVersionEntry[],
    packageName: string,
    repositoryInfo?: RepositoryInfo | null
  ): string {
    // Start with the header
    let content = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

`;

    // Add each version entry
    for (const entry of versionEntries) {
      content += `## 🔖 [${entry.version}] (${entry.date})\n\n`;

      for (const section of entry.sections) {
        content += `### ${section.type}\n\n`;
        if (section.content.trim()) {
          content += `${section.content}\n\n`;
        }
      }
    }

    // Add version links if repository info is available
    if (repositoryInfo) {
      content = this.addVersionLinksToChangelog(content, repositoryInfo, packageName);
    }

    return content;
  }

  /**
   * Gets current date in YYYY-MM-DD format.
   *
   * @returns Current date string
   */
  static getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}
