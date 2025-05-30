import { DR } from '@aneuhold/core-ts-lib';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandService } from './CommandService.js';
import { LocalPackageStoreService } from './LocalPackageStoreService.js';
import { VerdaccioService } from './VerdaccioService.js';

// Mock external dependencies
vi.mock('execa');
vi.mock('fs-extra');
vi.mock('./VerdaccioService.js');
vi.mock('./LocalPackageStoreService.js');

// Mock DR.logger to avoid console output during tests
vi.mock('@aneuhold/core-ts-lib', async () => {
  const actual = await vi.importActual('@aneuhold/core-ts-lib');
  return {
    ...actual,
    DR: {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
      }
    }
  };
});

describe('CommandService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');
  });

  describe('publish', () => {
    const mockPackageJson = {
      name: '@test/package',
      version: '1.0.0'
    };

    const mockPackageEntry = {
      originalVersion: '1.0.0',
      currentVersion: '1.0.0-20240530123456',
      subscribers: [],
      packageRootPath: '/test/project'
    };

    beforeEach(() => {
      // Mock fs.readJson to return mock package.json
      vi.mocked(fs.readJson).mockResolvedValue(mockPackageJson);

      // Mock VerdaccioService methods
      vi.mocked(VerdaccioService.start).mockResolvedValue(undefined);
      vi.mocked(VerdaccioService.stop).mockResolvedValue(undefined);
      vi.mocked(VerdaccioService.publishPackage).mockResolvedValue(undefined);

      // Mock LocalPackageStoreService methods
      vi.mocked(LocalPackageStoreService.getPackageEntry).mockResolvedValue(
        null
      );
      vi.mocked(LocalPackageStoreService.updatePackageEntry).mockResolvedValue(
        undefined
      );

      // Mock fs.writeJson for package.json updates
      vi.mocked(fs.writeJson).mockResolvedValue(undefined);
    });

    it('should successfully publish a package without subscribers', async () => {
      await CommandService.publish();

      // Verify package.json was read
      expect(fs.readJson).toHaveBeenCalledWith(
        path.join('/test/project', 'package.json')
      );

      // Verify Verdaccio lifecycle
      expect(VerdaccioService.start).toHaveBeenCalledOnce();
      expect(VerdaccioService.publishPackage).toHaveBeenCalledWith(
        '/test/project'
      );
      expect(VerdaccioService.stop).toHaveBeenCalledOnce();

      // Verify package entry was updated
      expect(LocalPackageStoreService.updatePackageEntry).toHaveBeenCalledWith(
        '@test/package',
        expect.objectContaining({
          originalVersion: '1.0.0',
          currentVersion: expect.stringMatching(/^1\.0\.0-\d{14}$/),
          subscribers: [],
          packageRootPath: '/test/project'
        })
      );

      // Verify package.json was updated with timestamp version and then restored
      expect(fs.writeJson).toHaveBeenCalledTimes(2);
      expect(fs.writeJson).toHaveBeenNthCalledWith(
        1,
        path.join('/test/project', 'package.json'),
        expect.objectContaining({
          name: '@test/package',
          version: expect.stringMatching(/^1\.0\.0-\d{14}$/)
        }),
        { spaces: 2 }
      );
      expect(fs.writeJson).toHaveBeenNthCalledWith(
        2,
        path.join('/test/project', 'package.json'),
        expect.objectContaining({
          name: '@test/package',
          version: '1.0.0'
        }),
        { spaces: 2 }
      );

      // Verify success message was logged
      expect(DR.logger.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /Successfully published @test\/package@1\.0\.0-\d{14}/
        )
      );
    });

    it('should successfully publish a package with existing subscribers', async () => {
      const mockExistingEntry = {
        ...mockPackageEntry,
        subscribers: ['/test/subscriber1', '/test/subscriber2']
      };

      const mockSubscriberPackageJson = {
        name: '@test/subscriber',
        version: '2.0.0',
        dependencies: {
          '@test/package': '1.0.0'
        }
      };

      // Mock existing package entry with subscribers
      vi.mocked(LocalPackageStoreService.getPackageEntry).mockResolvedValue(
        mockExistingEntry
      );

      // Mock subscriber package.json reads
      vi.mocked(fs.readJson)
        .mockResolvedValueOnce(mockPackageJson) // Initial package.json read
        .mockResolvedValue(mockSubscriberPackageJson); // Subscriber package.json reads

      // Mock execa for npm install commands
      vi.mocked(execa).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false
      });

      await CommandService.publish();

      // Verify subscribers were updated
      expect(fs.readJson).toHaveBeenCalledWith(
        path.join('/test/subscriber1', 'package.json')
      );
      expect(fs.readJson).toHaveBeenCalledWith(
        path.join('/test/subscriber2', 'package.json')
      );

      // Verify package.json updates for subscribers
      expect(fs.writeJson).toHaveBeenCalledWith(
        path.join('/test/subscriber1', 'package.json'),
        expect.objectContaining({
          dependencies: {
            '@test/package': expect.stringMatching(/^1\.0\.0-\d{14}$/)
          }
        }),
        { spaces: 2 }
      );

      // Verify install commands were run for subscribers
      expect(execa).toHaveBeenCalledWith('npm', ['install'], {
        cwd: '/test/subscriber1'
      });
      expect(execa).toHaveBeenCalledWith('npm', ['install'], {
        cwd: '/test/subscriber2'
      });

      // Verify info message about subscribers
      expect(DR.logger.info).toHaveBeenCalledWith('Updating 2 subscriber(s)');
    });

    it('should handle missing package.json gracefully', async () => {
      vi.mocked(fs.readJson).mockRejectedValue(
        new Error('ENOENT: no such file')
      );

      await expect(CommandService.publish()).rejects.toThrow(
        'No package.json found in current directory'
      );

      // Verify Verdaccio was not started
      expect(VerdaccioService.start).not.toHaveBeenCalled();
    });

    it('should handle package.json missing name field', async () => {
      vi.mocked(fs.readJson).mockResolvedValue({
        version: '1.0.0'
        // Missing name field
      });

      await expect(CommandService.publish()).rejects.toThrow(
        'No package.json found in current directory'
      );
    });

    it('should handle package.json missing version field', async () => {
      vi.mocked(fs.readJson).mockResolvedValue({
        name: '@test/package'
        // Missing version field
      });

      await expect(CommandService.publish()).rejects.toThrow(
        'No package.json found in current directory'
      );
    });

    it('should generate timestamp version correctly', async () => {
      const mockDate = new Date('2024-05-30T12:34:56.789Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

      await CommandService.publish();

      // Verify the timestamp version format
      expect(LocalPackageStoreService.updatePackageEntry).toHaveBeenCalledWith(
        '@test/package',
        expect.objectContaining({
          currentVersion: '1.0.0-20240530123456'
        })
      );
    });

    it('should preserve existing subscribers when updating package entry', async () => {
      const existingSubscribers = [
        '/path/to/subscriber1',
        '/path/to/subscriber2'
      ];
      const mockExistingEntry = {
        ...mockPackageEntry,
        subscribers: existingSubscribers
      };

      vi.mocked(LocalPackageStoreService.getPackageEntry).mockResolvedValue(
        mockExistingEntry
      );

      await CommandService.publish();

      expect(LocalPackageStoreService.updatePackageEntry).toHaveBeenCalledWith(
        '@test/package',
        expect.objectContaining({
          subscribers: existingSubscribers
        })
      );
    });

    it('should handle Verdaccio start failure', async () => {
      vi.mocked(VerdaccioService.start).mockRejectedValue(
        new Error('Failed to start Verdaccio')
      );

      await expect(CommandService.publish()).rejects.toThrow(
        'Failed to start Verdaccio'
      );

      // Verify cleanup wasn't attempted
      expect(VerdaccioService.stop).not.toHaveBeenCalled();
    });

    it('should handle publish failure', async () => {
      vi.mocked(VerdaccioService.publishPackage).mockRejectedValue(
        new Error('Publish failed')
      );

      await expect(CommandService.publish()).rejects.toThrow('Publish failed');

      // Verify Verdaccio was started but not stopped due to error
      expect(VerdaccioService.start).toHaveBeenCalledOnce();
    });

    it('should handle subscriber update failure gracefully', async () => {
      const mockExistingEntry = {
        ...mockPackageEntry,
        subscribers: ['/test/failing-subscriber']
      };

      vi.mocked(LocalPackageStoreService.getPackageEntry).mockResolvedValue(
        mockExistingEntry
      );

      // Mock subscriber package.json read to fail
      vi.mocked(fs.readJson)
        .mockResolvedValueOnce(mockPackageJson) // Initial package.json read succeeds
        .mockRejectedValueOnce(
          new Error('Failed to read subscriber package.json')
        ); // Subscriber read fails

      await CommandService.publish();

      // Verify error was logged but publish continued
      expect(DR.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to update subscriber /test/failing-subscriber'
        )
      );

      // Verify main publish still completed
      expect(DR.logger.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /Successfully published @test\/package@1\.0\.0-\d{14}/
        )
      );
    });
  });

  describe('generateTimestampVersion', () => {
    it('should generate correct timestamp format', () => {
      const mockDate = new Date('2024-05-30T12:34:56.789Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

      // Access the private method via reflection for testing
      const result = (CommandService as any).generateTimestampVersion('1.0.0');

      expect(result).toBe('1.0.0-20240530123456');
    });

    it('should handle different date formats', () => {
      const mockDate = new Date('2023-12-31T23:59:59.999Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const result = (CommandService as any).generateTimestampVersion('2.1.3');

      expect(result).toBe('2.1.3-20231231235959');
    });
  });

  describe('getPackageInfo', () => {
    it('should return package info for valid package.json', async () => {
      const mockPackageJson = {
        name: '@test/package',
        version: '1.0.0',
        description: 'Test package'
      };

      vi.mocked(fs.readJson).mockResolvedValue(mockPackageJson);

      const result = await (CommandService as any).getPackageInfo('/test/dir');

      expect(result).toEqual({
        name: '@test/package',
        version: '1.0.0'
      });

      expect(fs.readJson).toHaveBeenCalledWith('/test/dir/package.json');
    });

    it('should return null for missing package.json', async () => {
      vi.mocked(fs.readJson).mockRejectedValue(new Error('ENOENT'));

      const result = await (CommandService as any).getPackageInfo('/test/dir');

      expect(result).toBeNull();
      expect(DR.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error reading package.json')
      );
    });

    it('should return null for package.json missing name', async () => {
      vi.mocked(fs.readJson).mockResolvedValue({
        version: '1.0.0'
      });

      const result = await (CommandService as any).getPackageInfo('/test/dir');

      expect(result).toBeNull();
      expect(DR.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'package.json must contain name and version fields'
        )
      );
    });

    it('should return null for package.json missing version', async () => {
      vi.mocked(fs.readJson).mockResolvedValue({
        name: '@test/package'
      });

      const result = await CommandService.getPackageInfo('/test/dir');

      expect(result).toBeNull();
      expect(DR.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'package.json must contain name and version fields'
        )
      );
    });

    it('should use process.cwd() as default directory', async () => {
      const mockPackageJson = {
        name: '@test/package',
        version: '1.0.0'
      };

      vi.mocked(fs.readJson).mockResolvedValue(mockPackageJson);

      const result = await (CommandService as any).getPackageInfo();

      expect(result).toEqual({
        name: '@test/package',
        version: '1.0.0'
      });

      expect(fs.readJson).toHaveBeenCalledWith('/test/project/package.json');
    });
  });
});
