import type { ChangelogVersionEntry } from './types.js';
import { REQUIRED_SECTION_TYPES } from './types.js';

/**
 * Service for validating changelog entries and content.
 */
export default class ChangelogValidator {
  /**
   * Validates that a version entry meets the requirements.
   *
   * @param versionEntry The version entry to validate
   * @param version The version being validated (for error messages)
   * @throws {Error} Error if validation fails
   */
  static validateVersionEntry(versionEntry: ChangelogVersionEntry, version: string): void {
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
}
