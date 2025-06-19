import { describe, expect, it } from 'vitest';
import GlobMatchingService from './GlobMatchingService.js';

describe('Unit Tests', () => {
  describe('GlobMatchingService', () => {
    describe('matchesPattern', () => {
      it('should match exact file paths', () => {
        expect(GlobMatchingService.matchesPattern('file.txt', 'file.txt')).toBe(true);
        expect(GlobMatchingService.matchesPattern('file.txt', 'other.txt')).toBe(false);
      });

      it('should match single asterisk patterns', () => {
        expect(GlobMatchingService.matchesPattern('file.txt', '*.txt')).toBe(true);
        expect(GlobMatchingService.matchesPattern('file.js', '*.txt')).toBe(false);
        expect(GlobMatchingService.matchesPattern('test.spec.ts', '*.spec.ts')).toBe(true);
      });

      it('should match single asterisk patterns only in current directory, not subdirectories', () => {
        // Single * should match files in the current directory
        expect(GlobMatchingService.matchesPattern('file.txt', '*')).toBe(true);
        expect(GlobMatchingService.matchesPattern('test.js', '*')).toBe(true);
        expect(GlobMatchingService.matchesPattern('README.md', '*')).toBe(true);

        // Single * should NOT match files in subdirectories
        expect(GlobMatchingService.matchesPattern('src/file.txt', '*')).toBe(false);
        expect(GlobMatchingService.matchesPattern('lib/test.js', '*')).toBe(false);
        expect(GlobMatchingService.matchesPattern('docs/README.md', '*')).toBe(false);
        expect(GlobMatchingService.matchesPattern('deep/nested/file.txt', '*')).toBe(false);

        // Single * with extension should also only match in current directory
        expect(GlobMatchingService.matchesPattern('test.ts', '*.ts')).toBe(true);
        expect(GlobMatchingService.matchesPattern('src/test.ts', '*.ts')).toBe(false);
        expect(GlobMatchingService.matchesPattern('lib/utils.ts', '*.ts')).toBe(false);
      });

      it('should match double asterisk patterns', () => {
        expect(GlobMatchingService.matchesPattern('src/file.txt', '**/file.txt')).toBe(true);
        expect(GlobMatchingService.matchesPattern('src/deep/file.txt', '**/file.txt')).toBe(true);
        expect(GlobMatchingService.matchesPattern('file.txt', '**/file.txt')).toBe(true);
        expect(GlobMatchingService.matchesPattern('file.txt', '**/*')).toBe(true);
      });

      it('should match complex patterns', () => {
        expect(GlobMatchingService.matchesPattern('src/test.spec.ts', '**/*.spec.ts')).toBe(true);
        expect(GlobMatchingService.matchesPattern('test.spec.ts', '**/*.spec.ts')).toBe(true);
        expect(GlobMatchingService.matchesPattern('src/test.ts', '**/*.spec.ts')).toBe(false);
      });

      it('should handle node_modules exclusion patterns', () => {
        expect(
          GlobMatchingService.matchesPattern('node_modules/lib/file.js', '**/node_modules/**')
        ).toBe(true);
        expect(
          GlobMatchingService.matchesPattern('src/node_modules/lib/file.js', '**/node_modules/**')
        ).toBe(true);
        expect(GlobMatchingService.matchesPattern('src/file.js', '**/node_modules/**')).toBe(false);
      });
    });

    describe('getMatchingFiles', () => {
      it('should filter files based on include and exclude patterns', () => {
        const allFiles = [
          '/root/src/file1.ts',
          '/root/src/file2.js',
          '/root/node_modules/lib/file3.ts',
          '/root/test.spec.ts',
          '/root/src/test.spec.ts'
        ];
        const rootPath = '/root';
        const includePatterns = ['**/*.ts'];
        const excludePatterns = ['**/node_modules/**', '**/*.spec.ts'];

        const result = GlobMatchingService.getMatchingFiles(
          allFiles,
          rootPath,
          includePatterns,
          excludePatterns
        );

        expect(result).toEqual(['/root/src/file1.ts']);
      });

      it('should include all files when using **/* pattern', () => {
        const allFiles = ['/root/src/file1.ts', '/root/src/file2.js', '/root/README.md'];
        const rootPath = '/root';
        const includePatterns = ['**/*'];
        const excludePatterns: string[] = [];

        const result = GlobMatchingService.getMatchingFiles(
          allFiles,
          rootPath,
          includePatterns,
          excludePatterns
        );

        expect(result).toEqual(allFiles);
      });

      it('should filter files using single asterisk to match only current directory', () => {
        const allFiles = [
          '/root/file1.txt',
          '/root/file2.js',
          '/root/README.md',
          '/root/src/nested.txt',
          '/root/lib/utils.js',
          '/root/docs/guide.md'
        ];
        const rootPath = '/root';
        const includePatterns = ['*']; // Single star should only match files in root
        const excludePatterns: string[] = [];

        const result = GlobMatchingService.getMatchingFiles(
          allFiles,
          rootPath,
          includePatterns,
          excludePatterns
        );

        // Should only include files directly in /root, not in subdirectories
        expect(result).toEqual(['/root/file1.txt', '/root/file2.js', '/root/README.md']);
      });

      it('should filter files using single asterisk with extension', () => {
        const allFiles = [
          '/root/app.ts',
          '/root/config.js',
          '/root/README.md',
          '/root/src/component.ts',
          '/root/lib/utils.ts',
          '/root/test/spec.ts'
        ];
        const rootPath = '/root';
        const includePatterns = ['*.ts']; // Should only match .ts files in root
        const excludePatterns: string[] = [];

        const result = GlobMatchingService.getMatchingFiles(
          allFiles,
          rootPath,
          includePatterns,
          excludePatterns
        );

        // Should only include .ts files directly in /root
        expect(result).toEqual(['/root/app.ts']);
      });
    });
  });
});
