import { VersionType } from '../types/VersionType.js';

/**
 * A service which can be used to interact with strings.
 */
export default class StringService {
  /**
   * Gets the file extension of the provided file name.
   *
   * @param fileName the full name of the file or the entire file path
   * @returns a string containing the extension of the file name or undefined
   * if there is no extension
   */
  static getFileNameExtension(fileName: string): string | undefined {
    return fileName.split('.').pop();
  }

  /**
   * Compares two semantic version strings.
   *
   * @param version1 First version to compare
   * @param version2 Second version to compare
   * @returns -1 if version1 < version2, 0 if equal, 1 if version1 > version2
   */
  static compareSemanticVersions(version1: string, version2: string): number {
    const parts1 = version1.split('.').map(Number);
    const parts2 = version2.split('.').map(Number);

    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }

    return 0;
  }

  /**
   * Checks if a version needs to be bumped based on the desired version type.
   * This considers both registry conflicts and whether the requested version type
   * has been incremented from the published version.
   *
   * @param currentVersion The current version from package.json
   * @param publishedVersion The latest published version (or null if not published)
   * @param requestedVersionType The type of version bump requested
   * @returns true if a version bump is needed, false otherwise
   */
  static shouldBumpVersion(
    currentVersion: string,
    publishedVersion: string | null,
    requestedVersionType: VersionType
  ): boolean {
    // If no published version exists, no bump needed for first publish
    if (!publishedVersion) {
      return false;
    }

    const currentParts = currentVersion.split('.').map(Number);
    const publishedParts = publishedVersion.split('.').map(Number);

    const [currentMajor, currentMinor, currentPatch] = [
      currentParts[0] || 0,
      currentParts[1] || 0,
      currentParts[2] || 0
    ];
    const [publishedMajor, publishedMinor, publishedPatch] = [
      publishedParts[0] || 0,
      publishedParts[1] || 0,
      publishedParts[2] || 0
    ];

    // If current version is lower than or equal to published, always bump
    const comparison = StringService.compareSemanticVersions(currentVersion, publishedVersion);
    if (comparison <= 0) {
      return true;
    }

    // Current version is higher than published, check if requested version type has been bumped
    switch (requestedVersionType) {
      case VersionType.Major:
        // Need to bump if major version hasn't been incremented
        return currentMajor <= publishedMajor;

      case VersionType.Minor:
        // Need to bump if major is same and minor hasn't been incremented
        if (currentMajor > publishedMajor) {
          return false; // Major was already bumped, no need for minor
        }
        return currentMajor === publishedMajor && currentMinor <= publishedMinor;

      case VersionType.Patch:
      default:
        // Need to bump if major and minor are same and patch hasn't been incremented
        if (
          currentMajor > publishedMajor ||
          (currentMajor === publishedMajor && currentMinor > publishedMinor)
        ) {
          return false; // Major or minor was already bumped, no need for patch
        }
        return (
          currentMajor === publishedMajor &&
          currentMinor === publishedMinor &&
          currentPatch <= publishedPatch
        );
    }
  }
}
