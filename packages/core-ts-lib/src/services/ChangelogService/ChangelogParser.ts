import type { ChangelogSection, ChangelogSectionType, ChangelogVersionEntry } from './types.js';
import { REQUIRED_SECTION_TYPES } from './types.js';

/**
 * Service for parsing changelog content and extracting structured data.
 */
export default class ChangelogParser {
  /**
   * Parses a changelog file content and extracts version entries.
   *
   * @param content The changelog file content
   * @returns Array of parsed version entries
   */
  static parseChangelog(content: string): ChangelogVersionEntry[] {
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
        // Get content after the section header
        let sectionContent = lines.slice(1).join('\n');

        // Stop at HTML comments or link references which are not part of the section content
        const stopPatterns = [
          /^<!--/, // HTML comments
          /^\[.*\]:/ // Link references like [1.0.0]: http://...
        ];

        const contentLines = sectionContent.split('\n');
        const validContentLines: string[] = [];

        for (const line of contentLines) {
          const trimmedLine = line.trim();

          // Stop if we hit a pattern that indicates we're outside the section
          if (stopPatterns.some((pattern) => pattern.test(trimmedLine))) {
            break;
          }

          validContentLines.push(line);
        }

        sectionContent = validContentLines.join('\n').trim();
        sections.push({
          type: sectionType,
          content: sectionContent
        });
      }
    }

    return sections;
  }
}
