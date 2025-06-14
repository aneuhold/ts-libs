import { DR, FileSystemService, type PackageJson } from '@aneuhold/core-ts-lib';
import { execa } from 'execa';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { DEFAULT_CONFIG } from '../types/LocalNpmConfig.js';
import {
  PACKAGE_MANAGER_INFO,
  PackageManager
} from '../types/PackageManager.js';
import { ConfigService } from './ConfigService.js';

export type PackageManagerConfigBackup = {
  npmrc?: { path: string; content: string | null };
  yarnrc?: { path: string; content: string | null };
  yarnrcYml?: { path: string; content: string | null };
};

/**
 * Utility service for various package managers.
 */
export class PackageManagerService {
  /**
   * Cache to store detected package managers for projects.
   */
  private static configCache = new Map<
    string,
    {
      packageManager: PackageManager;
      timestamp: number;
    }
  >();
  private static readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Cache to store merged npmrc configurations by starting directory.
   */
  private static npmrcCache = new Map<string, Map<string, string>>();

  /**
   * Reads the package.json file in the specified directory.
   *
   * @param dir - Directory to search for package.json
   */
  static async getPackageInfo(
    dir: string = process.cwd()
  ): Promise<PackageJson | null> {
    try {
      const packageJsonPath = path.join(dir, 'package.json');
      const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;

      if (!packageJson.name || !packageJson.version) {
        throw new Error('package.json must contain name and version fields');
      }

      return packageJson;
    } catch (error) {
      DR.logger.error(`Error reading package.json: ${String(error)}`);
      return null;
    }
  }

  /**
   * Determines the package manager to use based on lock files and packageManager field in package.json.
   * Uses caching to reduce file I/O operations.
   *
   * @param projectPath - Path to the project directory to check
   */
  static async detectPackageManager(
    projectPath: string
  ): Promise<PackageManager> {
    const cacheKey = projectPath;
    const cached = this.configCache.get(cacheKey);

    // Check if cache is still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.packageManager;
    }

    // Cache miss or expired, detect package manager
    const packageManager = await this.detectPackageManagerUncached(projectPath);

    // Cache the result
    this.configCache.set(projectPath, {
      packageManager,
      timestamp: Date.now()
    });

    return packageManager;
  }

  /**
   * Clears the package manager cache for a specific project or all projects.
   *
   * @param projectPath - Optional path to clear cache for specific project
   */
  static clearCache(projectPath?: string): void {
    if (projectPath) {
      this.configCache.delete(projectPath);
    } else {
      this.configCache.clear();
    }
  }

  /**
   * Runs install command in a project directory using the default registry (npm, yarn, etc.).
   *
   * @param projectPath - Path to the project directory
   */
  static async runInstall(projectPath: string): Promise<void> {
    // Detect the package manager based on lock files in the target project
    const packageManager =
      await PackageManagerService.detectPackageManager(projectPath);

    const packageManagerInfo = PACKAGE_MANAGER_INFO[packageManager];

    try {
      DR.logger.info(
        `Running ${packageManagerInfo.displayName} install in ${projectPath}`
      );
      await execa(packageManagerInfo.command, ['install'], {
        cwd: projectPath
      });
      DR.logger.info(
        `${packageManagerInfo.displayName} install completed in ${projectPath}`
      );
    } catch (error) {
      DR.logger.error(
        `Error running install in ${projectPath}: ${String(error)}`
      );
      throw error;
    }
  }

  /**
   * Runs install command in a project directory using the specified registry.
   *
   * @param projectPath - Path to the project directory
   * @param registryUrl - The registry URL to use for installation
   */
  static async runInstallWithRegistry(
    projectPath: string,
    registryUrl?: string
  ): Promise<void> {
    const config = await ConfigService.loadConfig();
    const actualRegistryUrl =
      registryUrl || config.registryUrl || DEFAULT_CONFIG.registryUrl;

    // Detect the package manager based on lock files in the target project
    const packageManager =
      await PackageManagerService.detectPackageManager(projectPath);

    // Create registry configuration to ensure packages are installed from local registry
    const configBackup = await PackageManagerService.createRegistryConfig(
      packageManager,
      actualRegistryUrl,
      projectPath
    );

    try {
      // Use the base runInstall method to perform the actual installation
      await this.runInstall(projectPath);
    } catch (error) {
      DR.logger.error(
        `Error running install with registry in ${projectPath}: ${String(error)}`
      );
      throw error;
    } finally {
      // Always restore original configuration
      await PackageManagerService.restoreRegistryConfig(configBackup);
    }
  }

  /**
   * Creates registry configuration files for the specified package manager to use local registry.
   *
   * @param packageManager The package manager to configure
   * @param registryUrl The local registry URL
   * @param projectPath The path to the project directory
   */
  static async createRegistryConfig(
    packageManager: PackageManager,
    registryUrl: string,
    projectPath: string
  ): Promise<PackageManagerConfigBackup> {
    const backup: PackageManagerConfigBackup = {};
    const packageManagerInfo = PACKAGE_MANAGER_INFO[packageManager];

    const configPath = path.join(projectPath, packageManagerInfo.configFile);
    const existingContent = (await fs.pathExists(configPath))
      ? await fs.readFile(configPath, 'utf8')
      : null;

    // Store backup based on config file type
    if (packageManagerInfo.configFile === '.npmrc') {
      backup.npmrc = { path: configPath, content: existingContent };
    } else if (packageManagerInfo.configFile === '.yarnrc') {
      backup.yarnrc = { path: configPath, content: existingContent };
    } else if (packageManagerInfo.configFile === '.yarnrc.yml') {
      backup.yarnrcYml = { path: configPath, content: existingContent };
    }

    // Get package info to determine if we need organization-specific config
    const packageInfo = await this.getPackageInfo(projectPath);

    // Create or merge registry configuration using the package manager's format
    const registryConfig = this.generateRegistryConfig(
      packageManager,
      registryUrl,
      packageInfo
    );
    let finalConfigContent: string;

    if (existingContent) {
      // Merge with existing content
      finalConfigContent = this.mergeConfigContent(
        existingContent,
        registryConfig,
        packageManagerInfo.configFile
      );
    } else {
      // No existing content, use new config directly
      finalConfigContent = registryConfig;
    }

    await fs.writeFile(configPath, finalConfigContent);

    return backup;
  }

  /**
   * Restores the original registry configuration files.
   *
   * @param backup The backup of original configurations
   */
  static async restoreRegistryConfig(
    backup: PackageManagerConfigBackup
  ): Promise<void> {
    for (const config of Object.values(backup)) {
      if (config.content === null) {
        // File didn't exist originally, remove it
        if (await fs.pathExists(config.path)) {
          await fs.remove(config.path);
        }
      } else {
        const cleanedContent = this.removeLocalNpmRegistryLines(config.content);
        if (cleanedContent.length !== config.content.length) {
          config.content = cleanedContent.trim();
        }
        if (config.content === '') {
          await fs.remove(config.path);
        } else {
          // Restore original content
          await fs.writeFile(config.path, config.content);
        }
      }
    }
  }

  /**
   * Gets the current version specifier for a package from a project's package.json.
   *
   * @param projectPath - Path to the project directory containing package.json
   * @param packageName - Name of the package to find the specifier for
   * @returns The current version specifier or null if not found
   */
  static async getCurrentSpecifier(
    projectPath: string,
    packageName: string
  ): Promise<string | null> {
    const packageInfo = await this.getPackageInfo(projectPath);
    if (!packageInfo) {
      return null;
    }

    // Check dependencies
    if (packageInfo.dependencies?.[packageName]) {
      return packageInfo.dependencies[packageName];
    }

    // Check devDependencies
    if (packageInfo.devDependencies?.[packageName]) {
      return packageInfo.devDependencies[packageName];
    }

    // Check peerDependencies
    if (packageInfo.peerDependencies?.[packageName]) {
      return packageInfo.peerDependencies[packageName];
    }

    return null;
  }

  /**
   * Detects the package manager without caching.
   *
   * @param projectPath - Path to the project directory to check
   */
  private static async detectPackageManagerUncached(
    projectPath: string
  ): Promise<PackageManager> {
    // First, try to determine from package.json packageManager field
    const packageInfo = await this.getPackageInfo(projectPath);
    if (packageInfo && packageInfo.packageManager) {
      const packageManagerField = packageInfo.packageManager.toLowerCase();

      // Check for Yarn 4.x vs Yarn Classic
      if (packageManagerField.includes('yarn')) {
        if (
          packageManagerField.includes('yarn@4') ||
          packageManagerField.includes('yarn@5') ||
          packageManagerField.includes('yarn@6')
        ) {
          return PackageManager.Yarn4;
        }
        return PackageManager.Yarn;
      }

      // Check for pnpm
      if (packageManagerField.includes('pnpm')) {
        return PackageManager.Pnpm;
      }

      // Check for npm
      if (packageManagerField.includes('npm')) {
        return PackageManager.Npm;
      }
    }

    // Fallback to lock file detection
    // Check for lock files in order of preference
    if (
      await fs.pathExists(
        path.join(
          projectPath,
          PACKAGE_MANAGER_INFO[PackageManager.Pnpm].lockFile
        )
      )
    ) {
      return PackageManager.Pnpm;
    }

    if (
      await fs.pathExists(
        path.join(
          projectPath,
          PACKAGE_MANAGER_INFO[PackageManager.Yarn].lockFile
        )
      )
    ) {
      // If we have a yarn.lock but no packageManager field, default to Yarn Classic
      return PackageManager.Yarn;
    }

    if (
      await fs.pathExists(
        path.join(
          projectPath,
          PACKAGE_MANAGER_INFO[PackageManager.Npm].lockFile
        )
      )
    ) {
      return PackageManager.Npm;
    }

    // Default to npm if no lock file is found
    return PackageManager.Npm;
  }

  /**
   * Removes lines from configuration content that were previously added by local-npm-registry.
   *
   * @param content The configuration file content to clean
   */
  private static removeLocalNpmRegistryLines(content: string): string {
    const lines = content.split('\n');
    const cleanedLines = lines.filter((line) => {
      const trimmedLine = line.trim();
      // Remove lines that have the local-npm-registry comment
      return !trimmedLine.includes('#local-npm-registry');
    });
    return cleanedLines.join('\n');
  }

  /**
   * Merges new configuration content with existing configuration content.
   *
   * @param existingContent The existing configuration file content
   * @param newConfig The new configuration content to merge
   * @param configFile The configuration file name to determine merge strategy
   */
  private static mergeConfigContent(
    existingContent: string,
    newConfig: string,
    configFile: string
  ): string {
    if (configFile === '.yarnrc.yml') {
      return this.mergeYamlConfig(existingContent, newConfig);
    }
    return this.mergeKeyValueConfig(existingContent, newConfig);
  }

  /**
   * Merges YAML configuration content using proper YAML parsing.
   *
   * @param existingContent The existing YAML content
   * @param newConfig The new YAML content to merge
   */
  private static mergeYamlConfig(
    existingContent: string,
    newConfig: string
  ): string {
    const existingParsed = yaml.load(existingContent);
    const newParsed = yaml.load(newConfig);

    const existingData =
      typeof existingParsed === 'object' && existingParsed !== null
        ? (existingParsed as Record<string, unknown>)
        : {};

    const newData =
      typeof newParsed === 'object' && newParsed !== null
        ? (newParsed as Record<string, unknown>)
        : {};

    const mergedData = { ...existingData, ...newData };
    return yaml.dump(mergedData, { lineWidth: -1 });
  }

  /**
   * Merges key-value configuration content (for .npmrc and .yarnrc files).
   *
   * @param existingContent The existing key-value content
   * @param newConfig The new key-value content to merge
   */
  private static mergeKeyValueConfig(
    existingContent: string,
    newConfig: string
  ): string {
    const configMap = new Map<string, string>();

    // Parse existing content into map
    this.parseKeyValueLines(existingContent, configMap);

    // Parse and merge new content, which may override existing keys
    this.parseKeyValueLines(newConfig, configMap);

    // Convert back to string format
    return Array.from(configMap.values()).join('\n');
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

      if (
        !trimmedLine ||
        trimmedLine.startsWith('#') ||
        trimmedLine.startsWith(';')
      ) {
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

  /**
   * Generates registry configuration content based on package manager type and package info.
   *
   * @param packageManager The package manager to configure
   * @param registryUrl The registry URL to use
   * @param packageInfo The package information (optional, for organization-specific config)
   */
  private static generateRegistryConfig(
    packageManager: PackageManager,
    registryUrl: string,
    packageInfo?: PackageJson | null
  ): string {
    const packageManagerInfo = PACKAGE_MANAGER_INFO[packageManager];
    let config = packageManagerInfo.configFormat(registryUrl);

    // For npm-compatible config files, add organization-specific registry if package is scoped
    if (packageManagerInfo.configFile === '.npmrc' && packageInfo?.name) {
      const org = this.extractOrganization(packageInfo.name);
      if (org) {
        config += `@${org}:registry=${registryUrl} #local-npm-registry\n`;
      }
    }

    return config;
  }

  /**
   * Extracts the organization name from a scoped package name.
   *
   * @param packageName The package name (e.g., "@myorg/package-name")
   * @returns The organization name or null if not a scoped package
   */
  static extractOrganization(packageName: string): string | null {
    const orgMatch = packageName.match(/^@([^/]+)\//);
    return orgMatch ? orgMatch[1] : null;
  }

  /**
   * Retrieves and merges all .npmrc files from the current directory up the tree.
   * Keys found in closer directories take precedence over keys found in further directories.
   * Results are cached per starting directory for subsequent calls.
   *
   * @param startDir - Directory to start searching from (defaults to current working directory)
   */
  static async getAllNpmrcConfigs(
    startDir: string = process.cwd()
  ): Promise<Map<string, string>> {
    // Return cached result if available for this directory
    const cached = this.npmrcCache.get(startDir);
    if (cached) {
      return cached;
    }

    const configMap = new Map<string, string>();

    try {
      // Find all .npmrc files up the directory tree
      const npmrcPaths = await FileSystemService.findAllFilesUpTree(
        startDir,
        '.npmrc'
      );

      // Process files in order (furthest first, closest last) so closer files override further files
      for (let i = npmrcPaths.length - 1; i >= 0; i--) {
        const npmrcPath = npmrcPaths[i];
        try {
          const content = await fs.readFile(npmrcPath, 'utf8');
          this.parseNpmrcContent(content, configMap);
        } catch (error) {
          DR.logger.warn(
            `Failed to read .npmrc file at ${npmrcPath}: ${String(error)}`
          );
        }
      }

      // Cache the result for this directory
      this.npmrcCache.set(startDir, configMap);
      return configMap;
    } catch (error) {
      DR.logger.error(
        `Error retrieving .npmrc configurations: ${String(error)}`
      );
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
  private static parseNpmrcContent(
    content: string,
    configMap: Map<string, string>
  ): void {
    // Use the enhanced parseKeyValueLines with preserveLines=false to get key-value pairs directly
    this.parseKeyValueLines(content, configMap, false);
  }
}
