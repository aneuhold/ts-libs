import { DR } from '@aneuhold/core-ts-lib';
import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { LocalPackageStoreService } from '../services/LocalPackageStore.service.js';
import { MutexService } from '../services/Mutex.service.js';
import { VerdaccioService } from '../services/Verdaccio.service.js';
import { PruneCommand } from './PruneCommand.js';

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

describe('Integration Tests', () => {
  let testId: string;

  // Global setup/teardown for the tmp directory
  beforeAll(async () => {
    await TestProjectUtils.setupGlobalTempDir();
  });

  afterAll(async () => {
    await TestProjectUtils.cleanupGlobalTempDir();
    const testPackagePattern = /^@test-[a-fA-F0-9]{8}\//;
    await TestProjectUtils.mutateStore((store) =>
      LocalPackageStoreService.removePackagesByPattern(store, testPackagePattern)
    );
  });

  // Per-test setup/teardown for unique test instances
  beforeEach(async () => {
    vi.clearAllMocks();
    await TestProjectUtils.setupTestInstance();
    testId = randomUUID().slice(0, 8);
    TestProjectUtils.stubInstallWithoutRegistry();
    // Prune walks the whole store, so an entry another test left behind is
    // another dead publishing directory as far as it is concerned
    await TestProjectUtils.mutateStore((store) => {
      LocalPackageStoreService.clearStore(store);
    });
    try {
      await MutexService.forceReleaseLock();
    } catch {
      // Ignore errors if no lock exists or server wasn't running
    }
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await TestProjectUtils.cleanupTestInstance();
    try {
      await MutexService.forceReleaseLock();
      await VerdaccioService.stop();
    } catch {
      // Ignore errors during cleanup
    }
  });

  it('should restore the subscriber of a deleted publishing directory and leave a live one alone', async () => {
    const deadName = `@test-${testId}/deleted-lib`;
    const liveName = `@test-${testId}/live-lib`;

    const { publisherPath: deadPath, subscriberPath: deadSubscriberPath } =
      await TestProjectUtils.publishAndSubscribe(deadName, `@test-${testId}/dead-subscriber`);
    const { publisherPath: livePath, subscriberPath: liveSubscriberPath } =
      await TestProjectUtils.publishAndSubscribe(liveName, `@test-${testId}/live-subscriber`);

    const liveVersion = await TestProjectUtils.getCurrentVersion(liveName, livePath);

    // The publishing directory goes away, which nothing else in the tool visits
    await fs.remove(deadPath);

    await PruneCommand.execute();

    const store = await LocalPackageStoreService.getStore();
    expect(LocalPackageStoreService.getPackageEntry(store, deadName, deadPath)).toBeNull();
    expect(LocalPackageStoreService.getPackageEntry(store, liveName, livePath)).toBeTruthy();

    // The dead directory's subscriber is off the version that can never resolve
    // again, and the live directory's subscriber is untouched
    const deadSubscriberPackageJson = await TestProjectUtils.readPackageJson(deadSubscriberPath);
    const liveSubscriberPackageJson = await TestProjectUtils.readPackageJson(liveSubscriberPath);
    expect(deadSubscriberPackageJson.dependencies?.[deadName]).toBe('1.0.0');
    expect(liveSubscriberPackageJson.dependencies?.[liveName]).toBe(liveVersion);
  });

  it('should report when every publishing directory still exists', async () => {
    await TestProjectUtils.publishAndSubscribe(
      `@test-${testId}/intact-lib`,
      `@test-${testId}/intact-subscriber`
    );

    await PruneCommand.execute();

    expect(DR.logger.info).toHaveBeenCalledWith(
      'Every publishing directory in the local registry still exists'
    );
  });
});
