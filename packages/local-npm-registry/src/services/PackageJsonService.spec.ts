import { DR } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { PackageJsonService } from './PackageJsonService.js';

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
      const nonExistentPath = path.join(
        TestProjectUtils.getTestInstanceDir(),
        'non-existent'
      );

      const packageInfo =
        await PackageJsonService.getPackageInfo(nonExistentPath);

      expect(packageInfo).toBeNull();
      expect(DR.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error reading package.json')
      );
    });

    it('should return null for invalid package.json', async () => {
      const invalidDir = path.join(
        TestProjectUtils.getTestInstanceDir(),
        'invalid'
      );
      await fs.ensureDir(invalidDir);
      await fs.writeJson(path.join(invalidDir, 'package.json'), {
        description: 'Missing name and version'
      });

      const packageInfo = await PackageJsonService.getPackageInfo(invalidDir);

      expect(packageInfo).toBeNull();
      expect(DR.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'package.json must contain name and version fields'
        )
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
      const invalidDir = path.join(
        TestProjectUtils.getTestInstanceDir(),
        'malformed'
      );
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

  describe('extractOrganization', () => {
    it('should extract organization from scoped package name', () => {
      expect(
        PackageJsonService.extractOrganization('@myorg/package-name')
      ).toBe('myorg');
      expect(
        PackageJsonService.extractOrganization('@test/another-package')
      ).toBe('test');
      expect(PackageJsonService.extractOrganization('@company/ui-lib')).toBe(
        'company'
      );
    });

    it('should return null for non-scoped package names', () => {
      expect(PackageJsonService.extractOrganization('package-name')).toBeNull();
      expect(PackageJsonService.extractOrganization('react')).toBeNull();
      expect(PackageJsonService.extractOrganization('lodash')).toBeNull();
    });

    it('should return null for invalid package names', () => {
      expect(PackageJsonService.extractOrganization('')).toBeNull();
      expect(PackageJsonService.extractOrganization('@')).toBeNull();
      expect(PackageJsonService.extractOrganization('@/')).toBeNull();
      expect(PackageJsonService.extractOrganization('@org')).toBeNull();
    });
  });
});
