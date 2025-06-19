import { access, mkdir, readFile, rmdir, writeFile } from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChangelogService from './ChangelogService.js';

// Mock child_process module
vi.mock('child_process', () => ({
  execSync: vi.fn()
}));

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

    // Clear mocks
    vi.clearAllMocks();
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
      const { execSync } = await import('child_process');
      const mockExecSync = vi.mocked(execSync);

      // First initialization - no tags yet
      mockExecSync.mockReturnValue('');
      await ChangelogService.initializeChangelog('1.0.0', 'test-package', TEST_DIR);

      // Second call - mock that 1.0.0 now has a tag
      mockExecSync.mockReturnValue('test-package-v1.0.0\n');
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
      const { execSync } = await import('child_process');
      const mockExecSync = vi.mocked(execSync);

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

      // Initialize with first version - no tags yet
      mockExecSync.mockReturnValue('');
      await ChangelogService.initializeChangelog('1.0.0', '@test/test-package', TEST_DIR);

      // Add second version - mock that 1.0.0 now has a tag
      mockExecSync.mockReturnValue('test-package-v1.0.0\n');
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

    it('should handle existing changelog with tags and add new version', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockReturnValue('test-package-v1.0.0\n');

      // Create a mock package.json with repository information
      const mockPackageJson = {
        name: 'test-package',
        repository: {
          type: 'git',
          url: 'git+https://github.com/test-owner/test-repo.git'
        }
      };

      const packageJsonPath = path.join(TEST_DIR, 'package.json');
      await writeFile(packageJsonPath, JSON.stringify(mockPackageJson, null, 2));

      // Create an existing changelog with version 1.0.0
      const existingChangelog = `# Changelog

## 🔖 [1.0.0] (2025-06-18)

### ✅ Added

- Initial release
`;
      await writeFile(TEST_CHANGELOG_PATH, existingChangelog);

      // Initialize with new version 1.1.0
      await ChangelogService.initializeChangelog('1.1.0', 'test-package', TEST_DIR);

      const content = await readFile(TEST_CHANGELOG_PATH, 'utf-8');

      // Should contain both versions
      expect(content).toContain('[1.1.0]');
      expect(content).toContain('[1.0.0]');

      // 1.1.0 should appear before 1.0.0 (newest first)
      const v110Index = content.indexOf('[1.1.0]');
      const v100Index = content.indexOf('[1.0.0]');
      expect(v110Index).toBeLessThan(v100Index);
    });

    it('should update most recent version when no corresponding tag exists', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockReturnValue('\n');

      // Create an existing changelog with version 1.0.0
      const existingChangelog = `# Changelog

## 🔖 [1.0.0] (2025-06-18)

### ✅ Added

- Some feature
`;
      await writeFile(TEST_CHANGELOG_PATH, existingChangelog);

      // Initialize with new version 1.1.0 - should update existing entry
      await ChangelogService.initializeChangelog('1.1.0', 'test-package', TEST_DIR);

      const content = await readFile(TEST_CHANGELOG_PATH, 'utf-8');

      // Should contain 1.1.0 but not 1.0.0
      expect(content).toContain('[1.1.0]');
      expect(content).not.toContain('[1.0.0]');

      // Should preserve existing content
      expect(content).toContain('Some feature');
    });

    it('should remove older changelog entries that lack corresponding tags', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockReturnValue('test-package-v1.0.0\n');

      // Create an existing changelog with multiple versions
      const existingChangelog = `# Changelog

## 🔖 [1.1.0] (2025-06-19)

### ✅ Added

- New feature

## 🔖 [1.0.0] (2025-06-18)

### ✅ Added

- Initial release
`;
      await writeFile(TEST_CHANGELOG_PATH, existingChangelog);

      // Should remove 1.1.0 (no tag) and keep 1.0.0 (has tag), then update to 1.2.0
      await ChangelogService.initializeChangelog('1.2.0', 'test-package', TEST_DIR);

      const content = await readFile(TEST_CHANGELOG_PATH, 'utf-8');

      // Should contain 1.2.0 and 1.0.0, but not 1.1.0
      expect(content).toContain('[1.2.0]');
      expect(content).toContain('[1.0.0]');
      expect(content).not.toContain('[1.1.0]');

      // Should preserve content from 1.0.0
      expect(content).toContain('Initial release');
    });

    it('should handle git command failure gracefully', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      // Create an existing changelog
      const existingChangelog = `# Changelog

## 🔖 [1.0.0] (2025-06-18)

### ✅ Added

- Initial release
`;
      await writeFile(TEST_CHANGELOG_PATH, existingChangelog);

      // Should not throw but treat as no tags exist and update version
      await ChangelogService.initializeChangelog('1.1.0', 'test-package', TEST_DIR);

      const content = await readFile(TEST_CHANGELOG_PATH, 'utf-8');

      // Should update to 1.1.0
      expect(content).toContain('[1.1.0]');
      expect(content).not.toContain('[1.0.0]');
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
