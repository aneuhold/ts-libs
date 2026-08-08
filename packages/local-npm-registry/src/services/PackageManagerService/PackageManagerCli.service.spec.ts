import { DR } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProjectUtils } from '../../../test-utils/TestProjectUtils.js';
import { DEFAULT_CONFIG } from '../../types/LocalNpmConfig.js';
import { PackageManager } from '../../types/PackageManager.js';
import { LocalPackageStoreService } from '../LocalPackageStore.service.js';
import { PackageManagerCliService } from './PackageManagerCli.service.js';

vi.mock('execa');

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
  const registryUrl = DEFAULT_CONFIG.registryUrl;
  const authTokenArg = '--//localhost:4873/:_authToken=fake';

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
    vi.unstubAllEnvs();
    await TestProjectUtils.cleanupTestInstance();
  });

  describe('runInstall', () => {
    it('should run a bare install with npm_config_ variables stripped', async () => {
      const projectPath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/bare-install`,
        '1.0.0',
        PackageManager.Npm
      );
      // Package managers inject these, and they point back at the public registry
      vi.stubEnv('npm_config_registry', 'https://registry.npmjs.org/');

      await PackageManagerCliService.runInstall(projectPath, PackageManager.Npm);

      expect(execa).toHaveBeenCalledWith('npm', ['install'], {
        cwd: projectPath,
        env: environmentWithoutNpmConfig(),
        extendEnv: false
      });
    });

    it('should append the override arguments and environment', async () => {
      const projectPath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/override-install`,
        '1.0.0',
        PackageManager.Yarn
      );

      await PackageManagerCliService.runInstall(projectPath, PackageManager.Yarn, {
        args: ['--registry=http://example.com'],
        env: { npm_config_registry: 'http://example.com' }
      });

      expect(execa).toHaveBeenCalledWith('yarn', ['install', '--registry=http://example.com'], {
        cwd: projectPath,
        env: { ...environmentWithoutNpmConfig(), npm_config_registry: 'http://example.com' },
        extendEnv: false
      });
    });
  });

  describe('runInstallWithRegistry', () => {
    /**
     * Stands in for the install itself, so each test asserts the redirection that
     * gets handed to it
     */
    const mockRunInstall = () =>
      vi.spyOn(PackageManagerCliService, 'runInstall').mockResolvedValue(undefined);

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should pass npm scoped registry flags for every subscribed scope', async () => {
      const { subscriberPath, organization } = await createSubscription(PackageManager.Npm);
      const runInstall = mockRunInstall();

      await PackageManagerCliService.runInstallWithRegistry(
        subscriberPath,
        PackageManager.Npm,
        await LocalPackageStoreService.getStore(),
        registryUrl
      );

      expect(runInstall).toHaveBeenCalledWith(subscriberPath, PackageManager.Npm, {
        args: [
          `--registry=${registryUrl}`,
          `--@${organization}:registry=${registryUrl}`,
          authTokenArg
        ],
        env: {}
      });
    });

    it('should pass the same flags for pnpm as for npm', async () => {
      const { subscriberPath, organization } = await createSubscription(PackageManager.Pnpm);
      const runInstall = mockRunInstall();

      await PackageManagerCliService.runInstallWithRegistry(
        subscriberPath,
        PackageManager.Pnpm,
        await LocalPackageStoreService.getStore(),
        registryUrl
      );

      expect(runInstall).toHaveBeenCalledWith(subscriberPath, PackageManager.Pnpm, {
        args: [
          `--registry=${registryUrl}`,
          `--@${organization}:registry=${registryUrl}`,
          authTokenArg
        ],
        env: {}
      });
    });

    it('should pass Yarn Classic scopes through the environment', async () => {
      const { subscriberPath, organization } = await createSubscription(PackageManager.Yarn);
      const runInstall = mockRunInstall();

      await PackageManagerCliService.runInstallWithRegistry(
        subscriberPath,
        PackageManager.Yarn,
        await LocalPackageStoreService.getStore(),
        registryUrl
      );

      // Yarn Classic silently ignores the scoped flag, so it has to come through the env
      expect(runInstall).toHaveBeenCalledWith(subscriberPath, PackageManager.Yarn, {
        args: [`--registry=${registryUrl}`],
        env: { [`npm_config_@${organization}:registry`]: registryUrl }
      });
    });

    it('should pass Yarn Berry environment variables with an http whitelist', async () => {
      const { subscriberPath } = await createSubscription(PackageManager.Yarn4);
      const runInstall = mockRunInstall();

      await PackageManagerCliService.runInstallWithRegistry(
        subscriberPath,
        PackageManager.Yarn4,
        await LocalPackageStoreService.getStore(),
        registryUrl
      );

      expect(runInstall).toHaveBeenCalledWith(subscriberPath, PackageManager.Yarn4, {
        args: [],
        env: {
          YARN_NPM_REGISTRY_SERVER: registryUrl,
          YARN_UNSAFE_HTTP_WHITELIST: 'localhost'
        }
      });
    });

    it('should derive scopes from the store and nowhere else', async () => {
      // The subscriber's own scope and its .npmrc both differ from what it subscribes
      // to, and the old implementation drew the redirect set from exactly those two
      const subscriberPath = await TestProjectUtils.createTestPackage(
        `@consumer-${testId}/subscriber`,
        '1.0.0',
        PackageManager.Npm
      );
      const publisherPath = await TestProjectUtils.createTestPackage(
        `@publisher-${testId}/library`,
        '1.0.0',
        PackageManager.Npm
      );
      await TestProjectUtils.mutateStore((store) => {
        LocalPackageStoreService.updatePackageEntry(
          store,
          `@publisher-${testId}/library`,
          publisherPath,
          {
            originalVersion: '1.0.0',
            currentVersion: '1.0.0',
            subscribers: [{ subscriberPath, originalSpecifier: '1.0.0' }]
          }
        );
      });
      await TestProjectUtils.createNpmrcFile(
        subscriberPath,
        `@npmrc-${testId}:registry=https://custom-registry.com/\n`
      );
      const runInstall = mockRunInstall();

      await PackageManagerCliService.runInstallWithRegistry(
        subscriberPath,
        PackageManager.Npm,
        await LocalPackageStoreService.getStore(),
        registryUrl
      );

      expect(runInstall).toHaveBeenCalledWith(subscriberPath, PackageManager.Npm, {
        args: [
          `--registry=${registryUrl}`,
          `--@publisher-${testId}:registry=${registryUrl}`,
          authTokenArg
        ],
        env: {}
      });
    });

    it('should pass no scope flags for an unscoped subscribed package', async () => {
      const subscriberPath = await TestProjectUtils.createTestPackage(
        `@test-${testId}/unscoped-subscriber`,
        '1.0.0',
        PackageManager.Npm
      );
      const publisherPath = await TestProjectUtils.createTestPackage(
        `unscoped-library-${testId}`,
        '1.0.0',
        PackageManager.Npm
      );
      await TestProjectUtils.mutateStore((store) => {
        LocalPackageStoreService.updatePackageEntry(
          store,
          `unscoped-library-${testId}`,
          publisherPath,
          {
            originalVersion: '1.0.0',
            currentVersion: '1.0.0',
            subscribers: [{ subscriberPath, originalSpecifier: '1.0.0' }]
          }
        );
      });
      const runInstall = mockRunInstall();

      await PackageManagerCliService.runInstallWithRegistry(
        subscriberPath,
        PackageManager.Npm,
        await LocalPackageStoreService.getStore(),
        registryUrl
      );

      expect(runInstall).toHaveBeenCalledWith(subscriberPath, PackageManager.Npm, {
        args: [`--registry=${registryUrl}`, authTokenArg],
        env: {}
      });
    });

    it('should write no configuration file into the project', async () => {
      const { subscriberPath } = await createSubscription(PackageManager.Npm);
      const npmrcPath = path.join(subscriberPath, '.npmrc');

      await PackageManagerCliService.runInstallWithRegistry(
        subscriberPath,
        PackageManager.Npm,
        await LocalPackageStoreService.getStore(),
        registryUrl
      );

      expect(await fs.pathExists(npmrcPath)).toBe(false);
      expect(await fs.pathExists(`${npmrcPath}.tmp`)).toBe(false);

      // A failed install must not leave anything behind either
      vi.mocked(execa).mockRejectedValueOnce(new Error('install failed'));
      await expect(
        PackageManagerCliService.runInstallWithRegistry(
          subscriberPath,
          PackageManager.Npm,
          await LocalPackageStoreService.getStore(),
          registryUrl
        )
      ).rejects.toThrow();

      expect(await fs.pathExists(npmrcPath)).toBe(false);
      expect(await fs.pathExists(`${npmrcPath}.tmp`)).toBe(false);
    });

    it('should fall back to the configured registry when none is given', async () => {
      const { subscriberPath, organization } = await createSubscription(PackageManager.Npm);
      const runInstall = mockRunInstall();

      await PackageManagerCliService.runInstallWithRegistry(
        subscriberPath,
        PackageManager.Npm,
        await LocalPackageStoreService.getStore()
      );

      expect(runInstall).toHaveBeenCalledWith(subscriberPath, PackageManager.Npm, {
        args: [
          `--registry=${registryUrl}`,
          `--@${organization}:registry=${registryUrl}`,
          authTokenArg
        ],
        env: {}
      });
    });

    it('should warn when Yarn Berry pins a redirected scope in .yarnrc.yml', async () => {
      const { subscriberPath, organization } = await createSubscription(PackageManager.Yarn4);
      await fs.writeFile(
        path.join(subscriberPath, '.yarnrc.yml'),
        `npmScopes:\n  ${organization}:\n    npmRegistryServer: "https://custom-registry.com"\n`
      );
      mockRunInstall();

      await PackageManagerCliService.runInstallWithRegistry(
        subscriberPath,
        PackageManager.Yarn4,
        await LocalPackageStoreService.getStore(),
        registryUrl
      );

      expect(DR.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`npmScopes for @${organization}`)
      );
    });

    it('should not warn when .yarnrc.yml pins an unrelated scope', async () => {
      const { subscriberPath } = await createSubscription(PackageManager.Yarn4);
      await fs.writeFile(
        path.join(subscriberPath, '.yarnrc.yml'),
        `npmScopes:\n  unrelated-${testId}:\n    npmRegistryServer: "https://custom-registry.com"\n`
      );
      mockRunInstall();

      await PackageManagerCliService.runInstallWithRegistry(
        subscriberPath,
        PackageManager.Yarn4,
        await LocalPackageStoreService.getStore(),
        registryUrl
      );

      expect(DR.logger.warn).not.toHaveBeenCalled();
    });
  });

  /**
   * Builds the environment the service is expected to hand to a package manager
   * before any override is applied
   */
  const environmentWithoutNpmConfig = (): Record<string, string | undefined> =>
    Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('npm_config_'))
    );

  /**
   * Creates a subscriber project bound to a package in the store
   *
   * @param packageManager The package manager the subscriber uses
   */
  const createSubscription = async (packageManager: PackageManager) => {
    const organization = `test-${testId}`;
    const packageName = `@${organization}/library`;

    const { publisherPath, subscriberPath } = await TestProjectUtils.createSubscribedProjects(
      packageName,
      `@${organization}/subscriber`,
      packageManager
    );

    return { publisherPath, subscriberPath, organization, packageName };
  };
});
