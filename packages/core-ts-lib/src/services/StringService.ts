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
}
