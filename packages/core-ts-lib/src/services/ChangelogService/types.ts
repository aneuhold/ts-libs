export const CHANGELOG_FILENAME = 'CHANGELOG.md';
export const REQUIRED_SECTION_TYPES = ['✅ Added', '🏗️ Changed', '🩹 Fixed', '🔥 Removed'] as const;

export type ChangelogSectionType = (typeof REQUIRED_SECTION_TYPES)[number];

/**
 * Type guard that checks whether a string is one of the required
 * {@link ChangelogSectionType} values.
 *
 * @param value The value to narrow.
 */
export const isRequiredSectionType = (value: string): value is ChangelogSectionType =>
  REQUIRED_SECTION_TYPES.some((required) => required === value);

/**
 * Repository information for generating version links.
 */
export interface RepositoryInfo {
  owner: string;
  repo: string;
  url: string;
}

/**
 * Represents a section within a changelog version entry.
 */
export interface ChangelogSection {
  type: ChangelogSectionType;
  content: string;
}

/**
 * Represents a version entry in a changelog.
 */
export interface ChangelogVersionEntry {
  version: string;
  date: string;
  sections: ChangelogSection[];
}
