import { DR, FileSystemService } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';

/**
 * Service for managing .npmrc file operations and configurations.
 */
export class NpmrcService {
  /**
   * Cache to store merged npmrc configurations by starting directory.
   */
  private static npmrcCache = new Map<string, Map<string, string>>();

  /**
   * Retrieves and merges all .npmrc files from the current directory up the tree.
   * Keys found in closer directories take precedence over keys found in further directories.
   * Results are cached per starting directory for subsequent calls.
   *
   * @param startDir - Directory to start searching from (defaults to current working directory)
   */
  static async getAllNpmrcConfigs(startDir: string = process.cwd()): Promise<Map<string, string>> {
    // Return cached result if available for this directory
    const cached = this.npmrcCache.get(startDir);
    if (cached) {
      return cached;
    }

    const configMap = new Map<string, string>();

    try {
      // Find all .npmrc files up the directory tree
      const npmrcPaths = await FileSystemService.findAllFilesUpTree(startDir, '.npmrc');

      // Process files in order (furthest first, closest last) so closer files override further files
      for (let i = npmrcPaths.length - 1; i >= 0; i--) {
        const npmrcPath = npmrcPaths[i];
        try {
          const content = await fs.readFile(npmrcPath, 'utf8');
          this.parseNpmrcContent(content, configMap);
        } catch (error) {
          DR.logger.warn(`Failed to read .npmrc file at ${npmrcPath}: ${String(error)}`);
        }
      }

      // Cache the result for this directory
      this.npmrcCache.set(startDir, configMap);
      return configMap;
    } catch (error) {
      DR.logger.error(`Error retrieving .npmrc configurations: ${String(error)}`);
      return new Map();
    }
  }

  /**
   * Clears the npmrc cache. Should be called if .npmrc files are modified.
   */
  static clearNpmrcCache(): void {
    this.npmrcCache.clear();
  }

  /**
   * Parses .npmrc file content and adds key-value pairs to the provided map.
   * Keys will overwrite existing keys to allow closer files to take precedence.
   *
   * @param content - The .npmrc file content to parse
   * @param configMap - The map to store key-value pairs
   */
  private static parseNpmrcContent(content: string, configMap: Map<string, string>): void {
    // Use the enhanced parseKeyValueLines with preserveLines=false to get key-value pairs directly
    this.parseKeyValueLines(content, configMap, false);
  }

  /**
   * Parses key-value lines and adds them to the provided map.
   *
   * @param content The content to parse
   * @param configMap The map to store key-value pairs
   * @param preserveLines Whether to store full lines (true) or just values (false)
   */
  private static parseKeyValueLines(
    content: string,
    configMap: Map<string, string>,
    preserveLines = true
  ): void {
    const lines = content.split('\n').filter((line) => line.trim() !== '');

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith(';')) {
        if (preserveLines) {
          // Preserve comments and empty lines with original content
          configMap.set(trimmedLine || line, line);
        }
        continue;
      }

      const separatorIndex = trimmedLine.indexOf('=');
      if (separatorIndex > 0) {
        const key = trimmedLine.substring(0, separatorIndex).trim();

        if (preserveLines) {
          // Store original line format (for config merging)
          configMap.set(key, line);
        } else {
          // Store just the value (for npmrc parsing) - allow overwriting for precedence
          const value = trimmedLine.substring(separatorIndex + 1).trim();
          configMap.set(key, value);
        }
      } else if (preserveLines) {
        // Non-key-value line, preserve as-is
        configMap.set(trimmedLine, line);
      }
    }
  }
}
