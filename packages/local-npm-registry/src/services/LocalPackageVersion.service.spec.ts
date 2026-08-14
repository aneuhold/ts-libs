import { describe, expect, it } from 'vitest';
import { LocalPackageVersionService } from './LocalPackageVersion.service.js';

describe('Unit Tests', () => {
  describe('generateTimestampVersion', () => {
    /**
     * Reads the path slug out of a generated version
     *
     * @param version The version to read the slug from
     */
    const getSlugFrom = (version: string): string | undefined =>
      /-(p[0-9a-f]{8})\./.exec(version)?.[1];

    it('should append a fixed width slug that cannot be read as a number', () => {
      const version = LocalPackageVersionService.generateTimestampVersion('1.0.0', '/tmp/example');

      expect(version).toMatch(/^1\.0\.0-p[0-9a-f]{8}\.\d{17}$/);
      expect(getSlugFrom(version)).toBe('pf33aa924');
    });

    it('should derive the same slug for the same path', () => {
      const packagePath = '/Users/someone/dev/ts-libs/packages/core-ts-lib';

      expect(
        getSlugFrom(LocalPackageVersionService.generateTimestampVersion('1.0.0', packagePath))
      ).toBe(
        getSlugFrom(LocalPackageVersionService.generateTimestampVersion('2.3.4', packagePath))
      );
    });

    it('should derive a different slug for each path', () => {
      const first = LocalPackageVersionService.generateTimestampVersion(
        '1.0.0',
        '/dev/first-publisher/packages/lib'
      );
      const second = LocalPackageVersionService.generateTimestampVersion(
        '1.0.0',
        '/dev/second-publisher/packages/lib'
      );

      expect(getSlugFrom(first)).not.toBe(getSlugFrom(second));
    });

    it('should replace a suffix the original version already carries', () => {
      const version = LocalPackageVersionService.generateTimestampVersion(
        '1.0.0-pf33aa924.20250726123456789',
        '/dev/first-publisher/packages/lib'
      );

      expect(version).toMatch(/^1\.0\.0-p[0-9a-f]{8}\.\d{17}$/);
      expect(getSlugFrom(version)).not.toBe('pf33aa924');
    });
  });

  describe('removeSuffix', () => {
    it('should strip the suffix of any publishing directory', () => {
      expect(LocalPackageVersionService.removeSuffix('1.0.0-pf33aa924.20250726123456789')).toBe(
        '1.0.0'
      );
    });

    it('should leave a version carrying no suffix alone', () => {
      expect(LocalPackageVersionService.removeSuffix('1.0.0-rc.1')).toBe('1.0.0-rc.1');
    });
  });

  describe('versionStringIsForLocalPackage', () => {
    const packagePath = '/dev/first-publisher/packages/lib';

    it('should hold for a version generated for that directory', () => {
      const version = LocalPackageVersionService.generateTimestampVersion('1.0.0', packagePath);

      expect(LocalPackageVersionService.versionStringIsForLocalPackage(version, packagePath)).toBe(
        true
      );
    });

    it('should not hold for a version generated for another directory', () => {
      const version = LocalPackageVersionService.generateTimestampVersion(
        '1.0.0',
        '/dev/second-publisher/packages/lib'
      );

      expect(LocalPackageVersionService.versionStringIsForLocalPackage(version, packagePath)).toBe(
        false
      );
    });

    it('should not hold for a version carrying no suffix', () => {
      expect(LocalPackageVersionService.versionStringIsForLocalPackage('1.0.0', packagePath)).toBe(
        false
      );
    });

    it('should not hold for a specifier a suffixed version is only a range of', () => {
      const version = LocalPackageVersionService.generateTimestampVersion('1.0.0', packagePath);

      expect(
        LocalPackageVersionService.versionStringIsForLocalPackage(`^${version}-rc.1`, packagePath)
      ).toBe(false);
    });
  });
});
