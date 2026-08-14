import { DR } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConcurrentTestProjectUtils } from '../../test-utils/ConcurrentTestProjectUtils.js';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { PackageJsonService } from './PackageJson.service.js';

vi.mock('@aneuhold/core-ts-lib', async () => {
  const actual = await vi.importActual('@aneuhold/core-ts-lib');
  return {
    ...actual,
    DR: {
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
      }
    }
  };
});

let testId: string;

describe('PackageJsonService', () => {
  beforeAll(async () => {
    await TestProjectUtils.setupGlobalTempDir();
  });

  afterAll(async () => {
    await TestProjectUtils.cleanupGlobalTempDir();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestProjectUtils.setupTestInstance();
    testId = randomUUID().slice(0, 8);
  });

  afterEach(async () => {
    await TestProjectUtils.cleanupTestInstance();
  });

  describe('getPackageInfo', () => {
    it('should successfully read package.json file', async () => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/get-package-info`,
        '1.0.0'
      );

      const packageInfo = await PackageJsonService.getPackageInfo(packagePath);

      expect(packageInfo).toBeTruthy();
      expect(packageInfo?.name).toBe(`@test-${testId}/get-package-info`);
      expect(packageInfo?.version).toBe('1.0.0');
    });

    it('should return null for non-existent directory', async () => {
      const nonExistentPath = path.join(TestProjectUtils.getTestInstanceDir(), 'non-existent');

      const packageInfo = await PackageJsonService.getPackageInfo(nonExistentPath);

      expect(packageInfo).toBeNull();
      expect(DR.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error reading package.json')
      );
    });

    it('should return null for invalid package.json', async () => {
      const invalidDir = path.join(TestProjectUtils.getTestInstanceDir(), 'invalid');
      await fs.ensureDir(invalidDir);
      await fs.writeJson(path.join(invalidDir, 'package.json'), {
        description: 'Missing name and version'
      });

      const packageInfo = await PackageJsonService.getPackageInfo(invalidDir);

      expect(packageInfo).toBeNull();
      expect(DR.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('package.json must contain name and version fields')
      );
    });

    it('should use current working directory when no dir specified', async () => {
      const packagePath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/cwd-test`,
        '2.0.0'
      );

      // Change to the package directory
      TestProjectUtils.changeToProject(packagePath);

      const packageInfo = await PackageJsonService.getPackageInfo();

      expect(packageInfo).toBeTruthy();
      expect(packageInfo?.name).toBe(`@test-${testId}/cwd-test`);
      expect(packageInfo?.version).toBe('2.0.0');
    });

    it('should handle malformed package.json gracefully', async () => {
      const invalidDir = path.join(TestProjectUtils.getTestInstanceDir(), 'malformed');
      await fs.ensureDir(invalidDir);

      // Create malformed JSON file
      const packageJsonPath = path.join(invalidDir, 'package.json');
      await fs.writeFile(packageJsonPath, '{ invalid json');

      const packageInfo = await PackageJsonService.getPackageInfo(invalidDir);

      expect(packageInfo).toBeNull();
      expect(DR.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error reading package.json')
      );
    });
  });

  describe('updateVersionField', () => {
    it('should leave a version nested in another object alone', async () => {
      const projectPath = await writePackageJson(
        [
          '{',
          '  "name": "@test/nested-version",',
          '  "version": "1.0.0",',
          '  "volta": {',
          '    "version": "0.0.1"',
          '  }',
          '}',
          ''
        ].join('\n')
      );

      await PackageJsonService.updateVersionField(projectPath, '2.0.0');

      expect(await readPackageJsonText(projectPath)).toBe(
        [
          '{',
          '  "name": "@test/nested-version",',
          '  "version": "2.0.0",',
          '  "volta": {',
          '    "version": "0.0.1"',
          '  }',
          '}',
          ''
        ].join('\n')
      );
    });

    it('should write the version the file parses to rather than one that comes first', async () => {
      const projectPath = await writePackageJson(
        [
          '{',
          '\t"name": "@test/brace-in-script",',
          '\t"scripts": {',
          '\t\t"greet": "echo }"',
          '\t},',
          '\t"volta": {',
          '\t\t"version": "0.0.1"',
          '\t},',
          '\t"version": "1.0.0"',
          '}',
          ''
        ].join('\n')
      );

      await PackageJsonService.updateVersionField(projectPath, '2.0.0');

      expect(await readPackageJsonText(projectPath)).toBe(
        [
          '{',
          '\t"name": "@test/brace-in-script",',
          '\t"scripts": {',
          '\t\t"greet": "echo }"',
          '\t},',
          '\t"volta": {',
          '\t\t"version": "0.0.1"',
          '\t},',
          '\t"version": "2.0.0"',
          '}',
          ''
        ].join('\n')
      );
    });

    it('should leave the file readable while another process rewrites it', async () => {
      const projectPath = await writePackageJson(
        `${JSON.stringify({ name: '@test/concurrent-read', version: '1.0.0' }, null, 2)}\n`
      );
      const outputDirectory = path.join(TestProjectUtils.getTestInstanceDir(), `reads-${testId}`);
      await fs.ensureDir(outputDirectory);

      // One worker rewrites, the other two read, which is what a package
      // manager and Node's module resolution do to a subscriber being updated
      await ConcurrentTestProjectUtils.runConcurrently('readPackageJsonWhileRewritten.ts', 3, [
        projectPath,
        outputDirectory
      ]);

      const reports = (await fs.readdir(outputDirectory)).filter((fileName) =>
        fileName.startsWith('unreadable-')
      );
      expect(reports).toHaveLength(2);
      for (const report of reports) {
        expect(await fs.readFile(path.join(outputDirectory, report), 'utf-8')).toBe('0');
      }
      // Nothing the rewrites staged is left behind
      expect(await fs.readdir(projectPath)).toEqual(['package.json']);
    }, 30000);
  });

  describe('updateDependencySpecifiers', () => {
    it('should write every section that declares the package and nothing else', async () => {
      const projectPath = await writePackageJson(
        [
          '{',
          '    "name": "@test/every-section",',
          '    "dependencies": {',
          '        "@test/lib": "^1.0.0",',
          '        "@test/other": "^1.0.0"',
          '    },',
          '    "devDependencies": {',
          '        "@test/lib": "^1.0.0"',
          '    },',
          '    "peerDependencies": {',
          '        "@test/lib": "^1.0.0"',
          '    },',
          '    "overrides": {',
          '        "@test/lib": "^1.0.0"',
          '    }',
          '}',
          ''
        ].join('\n')
      );

      await PackageJsonService.updateDependencySpecifiers(
        projectPath,
        new Map([
          ['@test/lib', '1.0.0-pa1b2c3d4.20250528123456789'],
          ['@test/never-declared', '9.9.9']
        ])
      );

      // The four-space indentation is the file's own, the package it does not
      // declare is not added, and what an override forces is not its own
      // dependency to rewrite
      expect(await readPackageJsonText(projectPath)).toBe(
        [
          '{',
          '    "name": "@test/every-section",',
          '    "dependencies": {',
          '        "@test/lib": "1.0.0-pa1b2c3d4.20250528123456789",',
          '        "@test/other": "^1.0.0"',
          '    },',
          '    "devDependencies": {',
          '        "@test/lib": "1.0.0-pa1b2c3d4.20250528123456789"',
          '    },',
          '    "peerDependencies": {',
          '        "@test/lib": "1.0.0-pa1b2c3d4.20250528123456789"',
          '    },',
          '    "overrides": {',
          '        "@test/lib": "^1.0.0"',
          '    }',
          '}',
          ''
        ].join('\n')
      );
    });
  });

  describe('extractOrganization', () => {
    it('should extract organization from scoped package name', () => {
      expect(PackageJsonService.extractOrganizationFromPackageName('@myorg/package-name')).toBe(
        'myorg'
      );
      expect(PackageJsonService.extractOrganizationFromPackageName('@test/another-package')).toBe(
        'test'
      );
      expect(PackageJsonService.extractOrganizationFromPackageName('@company/ui-lib')).toBe(
        'company'
      );
    });

    it('should return null for non-scoped package names', () => {
      expect(PackageJsonService.extractOrganizationFromPackageName('package-name')).toBeNull();
      expect(PackageJsonService.extractOrganizationFromPackageName('react')).toBeNull();
      expect(PackageJsonService.extractOrganizationFromPackageName('lodash')).toBeNull();
    });

    it('should return null for invalid package names', () => {
      expect(PackageJsonService.extractOrganizationFromPackageName('')).toBeNull();
      expect(PackageJsonService.extractOrganizationFromPackageName('@')).toBeNull();
      expect(PackageJsonService.extractOrganizationFromPackageName('@/')).toBeNull();
      expect(PackageJsonService.extractOrganizationFromPackageName('@org')).toBeNull();
    });
  });

  /**
   * Writes a package.json exactly as given, which is what a test asserting on
   * the formatting a write left behind needs.
   *
   * @param content - The raw text of the package.json
   */
  const writePackageJson = async (content: string): Promise<string> => {
    const projectPath = path.join(TestProjectUtils.getTestInstanceDir(), `project-${testId}`);
    await fs.ensureDir(projectPath);
    await fs.writeFile(path.join(projectPath, 'package.json'), content, 'utf-8');

    return projectPath;
  };

  /**
   * The raw text of a project's package.json.
   *
   * @param projectPath - Path to the project directory containing package.json
   */
  const readPackageJsonText = async (projectPath: string): Promise<string> =>
    fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
});
