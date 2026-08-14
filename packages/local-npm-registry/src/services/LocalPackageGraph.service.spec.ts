import { DR } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import type { LocalPackageStore } from '../types/LocalPackageStore.js';
import { PackageManager } from '../types/PackageManager.js';
import { LocalPackageGraphService } from './LocalPackageGraph.service.js';
import { LocalPackageStoreService } from './LocalPackageStore.service.js';

vi.mock('@aneuhold/core-ts-lib', async () => {
  const actual = await vi.importActual('@aneuhold/core-ts-lib');
  return {
    ...actual,
    DR: {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
        setVerboseLogging: vi.fn(),
        isVerboseLoggingEnabled: vi.fn(() => false)
      }
    }
  };
});

describe('Unit Tests', () => {
  let testId: string;

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

  describe('getPublishOrderStartingFrom', () => {
    it('should publish each dependent once, after everything it depends on', async () => {
      const libName = `@test-${testId}/lib`;
      const dbLibName = `@test-${testId}/db-lib`;
      const apiLibName = `@test-${testId}/api-lib`;
      const appLibName = `@test-${testId}/app-lib`;

      // A diamond: the app reaches the library through both of the two
      // libraries in between
      const libPath = await TestProjectUtils.createTestPackage(libName);
      const dbLibPath = await TestProjectUtils.createTestPackage(
        dbLibName,
        '1.0.0',
        PackageManager.Npm,
        { [libName]: '^1.0.0' }
      );
      const apiLibPath = await TestProjectUtils.createTestPackage(
        apiLibName,
        '1.0.0',
        PackageManager.Npm,
        { [libName]: '^1.0.0' }
      );
      const appLibPath = await TestProjectUtils.createTestPackage(
        appLibName,
        '1.0.0',
        PackageManager.Npm,
        { [dbLibName]: '^1.0.0', [apiLibName]: '^1.0.0' }
      );

      const store = await createStore([
        { packageName: libName, packagePath: libPath },
        { packageName: dbLibName, packagePath: dbLibPath },
        { packageName: apiLibName, packagePath: apiLibPath },
        { packageName: appLibName, packagePath: appLibPath, hasSubscriber: true }
      ]);

      const publishedNames = (
        await LocalPackageGraphService.getPublishOrderStartingFrom(store, {
          packageName: libName,
          packagePath: libPath
        })
      ).map(({ packageName }) => packageName);

      expect(publishedNames).toHaveLength(4);
      expect(publishedNames[0]).toBe(libName);
      expect(publishedNames.indexOf(dbLibName)).toBeLessThan(publishedNames.indexOf(appLibName));
      expect(publishedNames.indexOf(apiLibName)).toBeLessThan(publishedNames.indexOf(appLibName));
    });

    it('should leave out a dependent that reaches no subscriber', async () => {
      const libName = `@test-${testId}/lib`;
      const subscribedName = `@test-${testId}/subscribed-lib`;
      const unreachedName = `@test-${testId}/unreached-lib`;

      const libPath = await TestProjectUtils.createTestPackage(libName);
      const subscribedPath = await TestProjectUtils.createTestPackage(
        subscribedName,
        '1.0.0',
        PackageManager.Npm,
        { [libName]: '^1.0.0' }
      );
      const unreachedPath = await TestProjectUtils.createTestPackage(
        unreachedName,
        '1.0.0',
        PackageManager.Npm,
        { [libName]: '^1.0.0' }
      );

      const store = await createStore([
        { packageName: libName, packagePath: libPath },
        { packageName: subscribedName, packagePath: subscribedPath, hasSubscriber: true },
        { packageName: unreachedName, packagePath: unreachedPath }
      ]);

      const publishedNames = (
        await LocalPackageGraphService.getPublishOrderStartingFrom(store, {
          packageName: libName,
          packagePath: libPath
        })
      ).map(({ packageName }) => packageName);

      // The package the publish runs for is published whether or not anything
      // installs it, since publishing it is what the command was asked to do
      expect(publishedNames).toEqual([libName, subscribedName]);
    });

    it('should throw naming the packages of a cycle', async () => {
      const firstName = `@test-${testId}/first-lib`;
      const secondName = `@test-${testId}/second-lib`;

      const firstPath = await TestProjectUtils.createTestPackage(
        firstName,
        '1.0.0',
        PackageManager.Npm,
        { [secondName]: '^1.0.0' }
      );
      const secondPath = await TestProjectUtils.createTestPackage(
        secondName,
        '1.0.0',
        PackageManager.Npm,
        { [firstName]: '^1.0.0' }
      );

      const store = await createStore([
        { packageName: firstName, packagePath: firstPath, hasSubscriber: true },
        { packageName: secondName, packagePath: secondPath, hasSubscriber: true }
      ]);

      await expect(
        LocalPackageGraphService.getPublishOrderStartingFrom(store, {
          packageName: firstName,
          packagePath: firstPath
        })
      ).rejects.toThrow(new RegExp(`${firstName}.*${secondName}`));
    });

    it('should not take a devDependency as an edge', async () => {
      const libName = `@test-${testId}/lib`;
      const toolName = `@test-${testId}/tool`;

      // The tool depends on the library and the library only builds with the
      // tool, which is a cycle as soon as a devDependency counts
      const libPath = await TestProjectUtils.createTestPackage(
        libName,
        '1.0.0',
        PackageManager.Npm,
        {},
        { [toolName]: '^1.0.0' }
      );
      const toolPath = await TestProjectUtils.createTestPackage(
        toolName,
        '1.0.0',
        PackageManager.Npm,
        { [libName]: '^1.0.0' }
      );

      const store = await createStore([
        { packageName: libName, packagePath: libPath, hasSubscriber: true },
        { packageName: toolName, packagePath: toolPath, hasSubscriber: true }
      ]);

      const publishedNames = (
        await LocalPackageGraphService.getPublishOrderStartingFrom(store, {
          packageName: libName,
          packagePath: libPath
        })
      ).map(({ packageName }) => packageName);

      expect(publishedNames).toEqual([libName, toolName]);
    });

    it('should resolve a dependency published from two directories by common ancestor', async () => {
      const libName = `@test-${testId}/lib`;
      const consumerName = `@test-${testId}/consumer`;

      const nearLibPath = await TestProjectUtils.createTestPackage(
        libName,
        '1.0.0',
        PackageManager.Npm,
        {},
        {},
        path.join('group-a', 'lib')
      );
      const farLibPath = await TestProjectUtils.createTestPackage(
        libName,
        '1.0.0',
        PackageManager.Npm,
        {},
        {},
        path.join('group-b', 'lib')
      );
      const consumerPath = await TestProjectUtils.createTestPackage(
        consumerName,
        '1.0.0',
        PackageManager.Npm,
        { [libName]: '^1.0.0' },
        {},
        path.join('group-a', 'consumer')
      );

      const store = await createStore([
        { packageName: libName, packagePath: nearLibPath },
        { packageName: libName, packagePath: farLibPath },
        { packageName: consumerName, packagePath: consumerPath, hasSubscriber: true }
      ]);

      const fromNearLib = await LocalPackageGraphService.getPublishOrderStartingFrom(store, {
        packageName: libName,
        packagePath: nearLibPath
      });
      const fromFarLib = await LocalPackageGraphService.getPublishOrderStartingFrom(store, {
        packageName: libName,
        packagePath: farLibPath
      });

      expect(fromNearLib.map(({ packageName }) => packageName)).toEqual([libName, consumerName]);
      expect(fromFarLib.map(({ packageName }) => packageName)).toEqual([libName]);
    });

    it('should drop the edge when two publishing directories sit equally close', async () => {
      const libName = `@test-${testId}/lib`;
      const consumerName = `@test-${testId}/consumer`;

      const firstLibPath = await TestProjectUtils.createTestPackage(
        libName,
        '1.0.0',
        PackageManager.Npm,
        {},
        {},
        'first-lib'
      );
      const secondLibPath = await TestProjectUtils.createTestPackage(
        libName,
        '1.0.0',
        PackageManager.Npm,
        {},
        {},
        'second-lib'
      );
      const consumerPath = await TestProjectUtils.createTestPackage(
        consumerName,
        '1.0.0',
        PackageManager.Npm,
        { [libName]: '^1.0.0' }
      );

      const store = await createStore([
        { packageName: libName, packagePath: firstLibPath },
        { packageName: libName, packagePath: secondLibPath },
        { packageName: consumerName, packagePath: consumerPath, hasSubscriber: true }
      ]);

      const publishOrder = await LocalPackageGraphService.getPublishOrderStartingFrom(store, {
        packageName: libName,
        packagePath: firstLibPath
      });

      expect(publishOrder.map(({ packageName }) => packageName)).toEqual([libName]);
      expect(DR.logger.warn).toHaveBeenCalledWith(expect.stringContaining(consumerPath));
    });
  });

  /**
   * Registers a set of published packages in a store, which is what the graph
   * takes as its nodes.
   *
   * @param publishedPackages - The packages to register, and whether anything subscribes to each
   */
  const createStore = async (
    publishedPackages: Array<{
      packageName: string;
      packagePath: string;
      hasSubscriber?: boolean;
    }>
  ): Promise<LocalPackageStore> => {
    const store = await LocalPackageStoreService.getStore();

    for (const { packageName, packagePath, hasSubscriber } of publishedPackages) {
      LocalPackageStoreService.updatePackageEntry(store, packageName, packagePath, {
        originalVersion: '1.0.0',
        currentVersion: '1.0.0',
        subscribers: hasSubscriber
          ? [
              {
                subscriberPath: path.join(TestProjectUtils.getTestInstanceDir(), 'subscriber'),
                originalSpecifier: '^1.0.0'
              }
            ]
          : []
      });
    }

    return store;
  };
});
