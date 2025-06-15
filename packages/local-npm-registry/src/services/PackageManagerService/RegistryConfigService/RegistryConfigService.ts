import { type PackageJson } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import {
  PACKAGE_MANAGER_INFO,
  PackageManager
} from '../../../types/PackageManager.js';
import { NpmrcService } from '../../NpmrcService.js';
import { PackageJsonService } from '../../PackageJsonService.js';

export type PackageManagerConfigBackup = {
  npmrc?: { path: string; content: string | null };
  yarnrc?: { path: string; content: string | null };
  yarnrcYml?: { path: string; content: string | null };
};

/**
 * Service for managing registry configuration files for different package managers.
 */
export class RegistryConfigService {
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
    const packageInfo = await PackageJsonService.getPackageInfo(projectPath);

    // Get all npmrc configurations to find existing organization registries
    const npmrcConfigs = await NpmrcService.getAllNpmrcConfigs(projectPath);

    // Create or merge registry configuration using the package manager's format
    const registryConfig = this.generateRegistryConfig(
      packageManager,
      registryUrl,
      packageInfo,
      npmrcConfigs
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
   * @param npmrcConfigs The existing npmrc configurations to extract organizations from
   */
  private static generateRegistryConfig(
    packageManager: PackageManager,
    registryUrl: string,
    packageInfo?: PackageJson | null,
    npmrcConfigs?: Map<string, string>
  ): string {
    const packageManagerInfo = PACKAGE_MANAGER_INFO[packageManager];
    let config = packageManagerInfo.configFormat(registryUrl);

    // For npm-compatible config files, add organization-specific registries
    if (packageManagerInfo.configFile === '.npmrc') {
      const organizations = new Set<string>();

      // Add organization from current package if it's scoped
      if (packageInfo?.name) {
        const org = PackageJsonService.extractOrganization(packageInfo.name);
        if (org) {
          organizations.add(org);
        }
      }

      // Extract organizations from existing npmrc configurations
      if (npmrcConfigs) {
        for (const [key] of npmrcConfigs) {
          // Look for organization-specific registry configurations: @org:registry=URL
          const orgRegistryMatch = key.match(/^@([^:]+):registry$/);
          if (orgRegistryMatch) {
            const org = orgRegistryMatch[1];
            organizations.add(org);
          }
        }
      }

      // Add organization-specific registry configurations
      for (const org of organizations) {
        config += `@${org}:registry=${registryUrl} #local-npm-registry\n`;
      }
    }

    return config;
  }
}
