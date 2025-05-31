import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MutexService } from './MutexService.js';
import { VerdaccioService } from './VerdaccioService.js';

describe('VerdaccioService', () => {
  beforeEach(async () => {
    // Ensure no lock exists before each test
    try {
      await MutexService.forceReleaseLock();
    } catch {
      // Ignore errors if no lock exists
    }
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await VerdaccioService.stop();
      await MutexService.forceReleaseLock();
    } catch {
      // Ignore errors during cleanup
    }
  });

  it('should acquire mutex lock when starting Verdaccio', async () => {
    // Verify no lock exists initially
    const initialLock = await MutexService.isLocked();
    expect(initialLock).toBe(false);

    // Start Verdaccio which should acquire the lock
    await VerdaccioService.start();

    // Verify lock is now held
    const lockAfterStart = await MutexService.isLocked();
    expect(lockAfterStart).toBe(true);
  });

  it('should release mutex lock when stopping Verdaccio', async () => {
    // Start Verdaccio to acquire lock
    await VerdaccioService.start();

    // Verify lock is held
    const lockAfterStart = await MutexService.isLocked();
    expect(lockAfterStart).toBe(true);

    // Stop Verdaccio which should release the lock
    await VerdaccioService.stop();

    // Verify lock is released
    const lockAfterStop = await MutexService.isLocked();
    expect(lockAfterStop).toBe(false);
  });

  it('should handle multiple start calls gracefully', async () => {
    // First start should succeed
    await VerdaccioService.start();

    // Verify lock is held
    const lockAfterFirstStart = await MutexService.isLocked();
    expect(lockAfterFirstStart).toBe(true);

    // Second start should not throw an error (should return early)
    await expect(VerdaccioService.start()).resolves.not.toThrow();

    // Lock should still be held
    const lockAfterSecondStart = await MutexService.isLocked();
    expect(lockAfterSecondStart).toBe(true);
  });

  it('should prevent multiple processes from starting Verdaccio simultaneously', async () => {
    // Use lockfile directly to create a lock from "another process"
    // We'll import lockfile and create a lock manually
    const lockfile = await import('proper-lockfile');
    const path = await import('path');
    const os = await import('os');

    const LOCK_DIR = path.join(os.tmpdir(), 'local-npm-registry');
    const LOCK_FILE_PATH = path.join(LOCK_DIR, 'verdaccio-registry');

    // Ensure the lock file exists
    await (await import('fs-extra')).ensureDir(LOCK_DIR);
    await (await import('fs-extra')).ensureFile(LOCK_FILE_PATH);

    // Acquire lock directly with lockfile (simulating another process)
    const release = await lockfile.lock(LOCK_FILE_PATH, {
      stale: 60000,
      retries: 0
    });

    // Verify lock is held
    const lockAfterAcquire = await MutexService.isLocked();
    expect(lockAfterAcquire).toBe(true);

    // Now attempt to acquire the lock through MutexService (simulating this process)
    // This should fail with a timeout error since the lock is already held
    await expect(async () => {
      await MutexService.acquireLock(1000); // 1 second timeout
    }).rejects.toThrow('Failed to acquire mutex lock:');

    // Original lock should still be held
    const lockAfterFailedStart = await MutexService.isLocked();
    expect(lockAfterFailedStart).toBe(true);

    // Release the external lock
    await release();
  });
});
