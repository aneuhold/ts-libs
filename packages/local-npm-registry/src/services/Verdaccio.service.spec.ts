import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import lockfile from 'proper-lockfile';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MutexLockName } from '../types/MutexLockName.js';
import { ConfigService } from './Config.service.js';
import { MutexService } from './Mutex.service.js';
import { VerdaccioService } from './Verdaccio.service.js';

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
  // Per-test setup/teardown for unique test instances
  beforeEach(async () => {
    // Ensure clean mutex state for each test
    try {
      await VerdaccioService.stop();
      await MutexService.forceReleaseLock(MutexLockName.Verdaccio);
    } catch {
      // Ignore errors if no lock exists or server wasn't running
    }
  });

  afterEach(async () => {
    // Clean up mutex lock and server after each test
    try {
      await VerdaccioService.stop();
      await MutexService.forceReleaseLock(MutexLockName.Verdaccio);
    } catch {
      // Ignore errors during cleanup
    }
  });

  it('should acquire mutex lock when starting Verdaccio', async () => {
    // Verify no lock exists initially
    const initialLock = await MutexService.isLocked(MutexLockName.Verdaccio);
    expect(initialLock).toBe(false);

    // Start Verdaccio which should acquire the lock
    await VerdaccioService.start();

    // Verify lock is now held
    const lockAfterStart = await MutexService.isLocked(MutexLockName.Verdaccio);
    expect(lockAfterStart).toBe(true);
  });

  it('should release mutex lock when stopping Verdaccio', async () => {
    // Start Verdaccio to acquire lock
    await VerdaccioService.start();

    // Verify lock is held
    const lockAfterStart = await MutexService.isLocked(MutexLockName.Verdaccio);
    expect(lockAfterStart).toBe(true);

    // Stop Verdaccio which should release the lock
    await VerdaccioService.stop();

    // Verify lock is released
    const lockAfterStop = await MutexService.isLocked(MutexLockName.Verdaccio);
    expect(lockAfterStop).toBe(false);
  });

  it('should handle multiple start calls gracefully', async () => {
    // First start should succeed
    await VerdaccioService.start();

    // Verify lock is held
    const lockAfterFirstStart = await MutexService.isLocked(MutexLockName.Verdaccio);
    expect(lockAfterFirstStart).toBe(true);

    // Second start should not throw an error (should return early)
    await expect(VerdaccioService.start()).resolves.not.toThrow();

    // Lock should still be held
    const lockAfterSecondStart = await MutexService.isLocked(MutexLockName.Verdaccio);
    expect(lockAfterSecondStart).toBe(true);
  });

  it('should wait for another process to release the lock instead of failing', async () => {
    // Use lockfile directly to create a lock from "another process"
    // We need to use the same path logic as MutexService

    // Get the lock file path that MutexService would use
    const config = await ConfigService.loadConfig();
    const baseDirectory = config.dataDirectory || os.homedir();
    const LOCK_DIR = path.join(baseDirectory, '.local-npm-registry');
    const LOCK_FILE_PATH = path.join(LOCK_DIR, MutexLockName.Verdaccio);

    // Ensure the lock file exists
    await fs.ensureDir(LOCK_DIR);
    await fs.ensureFile(LOCK_FILE_PATH);

    // Acquire lock directly with lockfile (simulating another process)
    const release = await lockfile.lock(LOCK_FILE_PATH, {
      stale: 60000,
      retries: 0
    });

    // Verify lock is held
    const lockAfterAcquire = await MutexService.isLocked(MutexLockName.Verdaccio);
    expect(lockAfterAcquire).toBe(true);

    // Now attempt to acquire the lock through MutexService (simulating this process),
    // which queues behind the holder rather than giving up
    let acquired = false;
    const acquisition = MutexService.acquireLock(MutexLockName.Verdaccio).then(() => {
      acquired = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(acquired).toBe(false);

    // Release the external lock, which lets the queued acquisition through
    await release();
    await acquisition;

    expect(acquired).toBe(true);
    expect(await MutexService.isLocked(MutexLockName.Verdaccio)).toBe(true);
  });
});
