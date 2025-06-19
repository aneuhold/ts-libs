import { access, mkdir, readFile, rmdir, writeFile } from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ChangelogService from './ChangelogService.js';

const TEST_DIR = path.join(process.cwd(), 'test-temp-changelog');
const TEST_CHANGELOG_PATH = path.join(TEST_DIR, 'CHANGELOG.md');

describe('Unit Tests', () => {
  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await rmdir(TEST_DIR, { recursive: true });
    } catch {
      // Directory might not exist, ignore
    }
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await rmdir(TEST_DIR, { recursive: true });
    } catch {
      // Directory might not exist, ignore
    }
  });

  describe('initializeChangelog', () => {
    it('should create a new changelog file', async () => {
      await ChangelogService.initializeChangelog('1.0.0', 'test-package', TEST_DIR);

      const changelogExists = await access(TEST_CHANGELOG_PATH)
        .then(() => true)
        .catch(() => false);

      expect(changelogExists).toBe(true);

      const content = await readFile(TEST_CHANGELOG_PATH, 'utf-8');
      expect(content).toContain('# Changelog');
      expect(content).toContain('🔖 [1.0.0]');
      expect(content).toContain('### ✅ Added');
      expect(content).toContain('### 🏗️ Changed');
      expect(content).toContain('### 🩹 Fixed');
      expect(content).toContain('### 🔥 Removed');
    });

    it('should be idempotent - not modify existing changelog with same version', async () => {
      // First initialization
      await ChangelogService.initializeChangelog('1.0.0', 'test-package', TEST_DIR);
      const firstContent = await readFile(TEST_CHANGELOG_PATH, 'utf-8');

      // Second initialization with same version
      await ChangelogService.initializeChangelog('1.0.0', 'test-package', TEST_DIR);
      const secondContent = await readFile(TEST_CHANGELOG_PATH, 'utf-8');

      expect(firstContent).toBe(secondContent);
    });

    it('should add new version entry to existing changelog', async () => {
      // First initialization
      await ChangelogService.initializeChangelog('1.0.0', 'test-package', TEST_DIR);

      // Add new version
      await ChangelogService.initializeChangelog('1.1.0', 'test-package', TEST_DIR);

      const content = await readFile(TEST_CHANGELOG_PATH, 'utf-8');
      expect(content).toContain('[1.0.0]');
      expect(content).toContain('[1.1.0]');

      // 1.1.0 should appear before 1.0.0 (newest first)
      const v110Index = content.indexOf('[1.1.0]');
      const v100Index = content.indexOf('[1.0.0]');
      expect(v110Index).toBeLessThan(v100Index);
    });

    it('should include version links when repository info is available', async () => {
      // Create a mock package.json with repository information
      const mockPackageJson = {
        name: '@test/test-package',
        repository: {
          type: 'git',
          url: 'git+https://github.com/test-owner/test-repo.git'
        }
      };

      const packageJsonPath = path.join(TEST_DIR, 'package.json');
      await writeFile(packageJsonPath, JSON.stringify(mockPackageJson, null, 2));

      await ChangelogService.initializeChangelog('1.0.0', '@test/test-package', TEST_DIR);

      const content = await readFile(TEST_CHANGELOG_PATH, 'utf-8');
      expect(content).toContain('# Changelog');
      expect(content).toContain('[1.0.0]');
      expect(content).toContain('### ✅ Added');
      expect(content).toContain('### 🏗️ Changed');
      expect(content).toContain('### 🩹 Fixed');
      expect(content).toContain('### 🔥 Removed');

      // Check for version links section
      expect(content).toContain('<!-- Link References -->');
      expect(content).toContain(
        '[1.0.0]: https://github.com/test-owner/test-repo/releases/tag/test-package-v1.0.0'
      );
    });

    it('should generate compare links for multiple versions', async () => {
      // Create a mock package.json with repository information
      const mockPackageJson = {
        name: '@test/test-package',
        repository: {
          type: 'git',
          url: 'git+https://github.com/test-owner/test-repo.git'
        }
      };

      const packageJsonPath = path.join(TEST_DIR, 'package.json');
      await writeFile(packageJsonPath, JSON.stringify(mockPackageJson, null, 2));

      // Initialize with first version
      await ChangelogService.initializeChangelog('1.0.0', '@test/test-package', TEST_DIR);

      // Add second version
      await ChangelogService.initializeChangelog('1.1.0', '@test/test-package', TEST_DIR);

      const content = await readFile(TEST_CHANGELOG_PATH, 'utf-8');

      // Check for version links section with compare URLs
      expect(content).toContain('<!-- Link References -->');
      expect(content).toContain(
        '[1.1.0]: https://github.com/test-owner/test-repo/compare/test-package-v1.0.0...test-package-v1.1.0'
      );
      expect(content).toContain(
        '[1.0.0]: https://github.com/test-owner/test-repo/releases/tag/test-package-v1.0.0'
      );
    });
  });

  describe('validateChangelogForVersion', () => {
    it('should throw error if changelog does not exist', async () => {
      await expect(ChangelogService.validateChangelogForVersion('1.0.0', TEST_DIR)).rejects.toThrow(
        'No CHANGELOG.md file found'
      );
    });

    it('should throw error if version entry does not exist', async () => {
      await ChangelogService.initializeChangelog('1.0.0', 'test-package', TEST_DIR);

      await expect(ChangelogService.validateChangelogForVersion('2.0.0', TEST_DIR)).rejects.toThrow(
        'No changelog entry found for version 2.0.0'
      );
    });

    it('should fail validation for freshly initialized changelog with all empty sections', async () => {
      await ChangelogService.initializeChangelog('1.0.0', 'test-package', TEST_DIR);

      await expect(ChangelogService.validateChangelogForVersion('1.0.0', TEST_DIR)).rejects.toThrow(
        'has empty changelog sections'
      );
    });

    it('should throw error if version has empty sections', async () => {
      const invalidChangelog = `# Changelog

## 🔖 [1.0.0] (2025-06-19)

### ✅ Added

### 🩹 Fixed
`;
      await writeFile(TEST_CHANGELOG_PATH, invalidChangelog);

      await expect(ChangelogService.validateChangelogForVersion('1.0.0', TEST_DIR)).rejects.toThrow(
        'has empty changelog sections'
      );
    });

    it('should fail validation if some sections have content but others are empty', async () => {
      const invalidChangelog = `# Changelog

## 🔖 [1.0.0] (2025-06-19)

### ✅ Added

- New feature added

### 🏗️ Changed

### 🩹 Fixed

### 🔥 Removed
`;
      await writeFile(TEST_CHANGELOG_PATH, invalidChangelog);

      await expect(ChangelogService.validateChangelogForVersion('1.0.0', TEST_DIR)).rejects.toThrow(
        'has empty changelog sections'
      );
    });

    it('should pass validation when all present sections have content', async () => {
      const validChangelog = `# Changelog

## 🔖 [1.0.0] (2025-06-19)

### ✅ Added

- New feature added

### 🩹 Fixed

- Bug fix applied
`;
      await writeFile(TEST_CHANGELOG_PATH, validChangelog);

      await expect(
        ChangelogService.validateChangelogForVersion('1.0.0', TEST_DIR)
      ).resolves.not.toThrow();
    });

    it('should handle breaking changes format', async () => {
      const changelogWithBreaking = `# Changelog

## 🔖 [2.0.0] (2025-06-19)

### 🏗️ Changed

- *Breaking*: Updated API interface
- Minor improvement to logging
`;
      await writeFile(TEST_CHANGELOG_PATH, changelogWithBreaking);

      await expect(
        ChangelogService.validateChangelogForVersion('2.0.0', TEST_DIR)
      ).resolves.not.toThrow();
    });

    it('should fail validation when version has no sections at all', async () => {
      const changelogWithNoSections = `# Changelog

## 🔖 [1.0.0] (2025-06-19)

Some text but no sections.
`;
      await writeFile(TEST_CHANGELOG_PATH, changelogWithNoSections);

      await expect(ChangelogService.validateChangelogForVersion('1.0.0', TEST_DIR)).rejects.toThrow(
        'has no changelog sections'
      );
    });
  });
});
