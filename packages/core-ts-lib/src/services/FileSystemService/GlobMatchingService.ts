import path from 'path';

/**
 * A service for handling glob-like pattern matching operations.
 * Supports common glob patterns like **, *, and exact matches.
 *
 * Inspired by the isaacs/node-glob library (ISC License)
 * but simplified for basic use cases.
 */
export default class GlobMatchingService {
  /**
   * Gets files matching the include patterns while excluding those that match exclude patterns.
   * Uses simple glob-like matching for common patterns.
   *
   * @param allFiles Array of all file paths to filter
   * @param rootPath The root directory path for computing relative paths
   * @param includePatterns Array of glob-like patterns to include
   * @param excludePatterns Array of glob-like patterns to exclude
   */
  static getMatchingFiles(
    allFiles: string[],
    rootPath: string,
    includePatterns: string[],
    excludePatterns: string[]
  ): string[] {
    return allFiles.filter((filePath) => {
      const relativePath = path.relative(rootPath, filePath);

      // Check if file matches any exclude pattern
      if (excludePatterns.some((pattern) => this.matchesPattern(relativePath, pattern))) {
        return false;
      }

      // Check if file matches any include pattern
      return includePatterns.some((pattern) => this.matchesPattern(relativePath, pattern));
    });
  }

  /**
   * Simple glob-like pattern matching for common use cases.
   * Supports:
   * - ** for any number of directories (globstar)
   * - * for any characters except path separators
   * - Exact matches
   *
   * @param filePath The file path to test
   * @param pattern The pattern to match against
   */
  static matchesPattern(filePath: string, pattern: string): boolean {
    // Normalize path separators to forward slashes
    const normalizedPath = filePath.replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/\\/g, '/');

    // Handle special case of **/* which should match everything
    if (normalizedPattern === '**/*') {
      return true;
    }

    // Split into segments for more precise matching
    const pathSegments = normalizedPath.split('/');
    const patternSegments = normalizedPattern.split('/');

    return this.matchSegments(pathSegments, patternSegments);
  }

  /**
   * Match path segments against pattern segments with support for globstar (**).
   *
   * The idea is that each segment doesn't cross path separators. It should
   * be split by '/' and then matched segment by segment.
   *
   * @param pathSegments Array of path segments
   * @param patternSegments Array of pattern segments
   */
  private static matchSegments(pathSegments: string[], patternSegments: string[]): boolean {
    let pathIndex = 0;
    let patternIndex = 0;

    while (pathIndex < pathSegments.length && patternIndex < patternSegments.length) {
      const pathSegment = pathSegments[pathIndex];
      const patternSegment = patternSegments[patternIndex];

      if (patternSegment === '**') {
        // Handle globstar - it can match zero or more segments
        patternIndex++;

        // If ** is the last segment, it matches everything remaining
        if (patternIndex >= patternSegments.length) {
          return true;
        }

        // Try to match the rest of the pattern against remaining path segments
        const remainingPattern = patternSegments.slice(patternIndex);

        // Try matching from current position onwards
        for (let i = pathIndex; i <= pathSegments.length; i++) {
          const remainingPath = pathSegments.slice(i);
          if (this.matchSegments(remainingPath, remainingPattern)) {
            return true;
          }
        }

        return false;
      } else if (this.matchSingleSegment(pathSegment, patternSegment)) {
        // Regular segment match
        pathIndex++;
        patternIndex++;
      } else {
        return false;
      }
    }

    // Check if we've consumed both path and pattern completely
    // or if remaining pattern segments are only globstars
    const remainingPattern = patternSegments.slice(patternIndex);
    const pathConsumed = pathIndex >= pathSegments.length;
    const patternConsumed = patternIndex >= patternSegments.length;

    if (pathConsumed && patternConsumed) {
      return true;
    }

    if (pathConsumed && remainingPattern.every((seg) => seg === '**')) {
      return true;
    }

    return false;
  }

  /**
   * Match a single segment with support for * wildcard
   *
   * @param pathSegment Single path segment
   * @param patternSegment Single pattern segment
   */
  private static matchSingleSegment(pathSegment: string, patternSegment: string): boolean {
    if (patternSegment === '*') {
      return true;
    }

    if (patternSegment === pathSegment) {
      return true;
    }

    // Convert pattern to regex for more complex matching
    const regexPattern = patternSegment
      .replace(/\./g, '\\.') // Escape dots
      .replace(/\*/g, '[^/]*'); // * matches anything except slashes

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(pathSegment);
  }
}
