import { DR } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import path from 'path';
import lockfile from 'proper-lockfile';
import { MutexLockName } from '../types/MutexLockName.js';
import { ConfigService } from './Config.service.js';

/**
 * Service to manage system-wide mutex locks.
 *
 * Note that cleanup is setup automatically via the proper-lockfile library if
 * the process exits unexpectedly.
 */
export class MutexService {
  static readonly #LOCK_CHECK_INTERVAL = 100;

  /**
   * Interval between the log lines that report how long a lock has been waited on.
   */
  static readonly #WAIT_LOG_INTERVAL = 5000;

  /**
   * Lock release functions mapped by mutex lock name.
   */
  static readonly #lockReleases = new Map<MutexLockName, () => Promise<void>>();

  /**
   * Runs an operation while holding a system-wide mutex lock, releasing the lock
   * however the operation ends.
   *
   * @param lockName - The lock to hold for the length of the operation
   * @param operation - Runs while the lock is held
   */
  static async withLock<TResult>(
    lockName: MutexLockName,
    operation: () => Promise<TResult>
  ): Promise<TResult> {
    await MutexService.acquireLock(lockName);

    try {
      return await operation();
    } finally {
      await MutexService.releaseLock(lockName);
    }
  }

  /**
   * Acquires a system-wide mutex lock, waiting until it is available.
   *
   * @param lockName - The lock to acquire
   */
  static async acquireLock(lockName: MutexLockName): Promise<void> {
    if (MutexService.#lockReleases.has(lockName)) {
      DR.logger.info(`Lock "${lockName}" already acquired by this process`);
      return;
    }

    // proper-lockfile exposes no per-retry hook, so progress while waiting is
    // reported from here.
    const waitStart = Date.now();
    const waitLogInterval = setInterval(() => {
      const elapsedSeconds = Math.round((Date.now() - waitStart) / 1000);
      DR.logger.info(`Still waiting for the "${lockName}" lock after ${elapsedSeconds}s...`);
    }, MutexService.#WAIT_LOG_INTERVAL);

    try {
      DR.logger.info(`Attempting to acquire the "${lockName}" mutex lock...`);

      // Ensure lock directory exists
      await MutexService.#ensureLockFileExists(lockName);

      const lockFilePath = await MutexService.#getLockFilePath(lockName);

      // Use proper-lockfile's built-in retry mechanism. `stale` is left as the default which is
      // 10 seconds.
      MutexService.#lockReleases.set(
        lockName,
        await lockfile.lock(lockFilePath, {
          retries: {
            // Wait for the holder however long it takes. Some installs can take a very long time.
            forever: true,
            factor: 1, // No exponential backoff
            minTimeout: MutexService.#LOCK_CHECK_INTERVAL, // Wait between retries
            maxTimeout: MutexService.#LOCK_CHECK_INTERVAL, // Keep constant interval
            randomize: false // No jitter
          }
        })
      );

      DR.logger.info(`Successfully acquired the "${lockName}" mutex lock`);
    } catch (error) {
      const errorMessage = `Failed to acquire the "${lockName}" mutex lock: ${String(error)}`;
      DR.logger.error(errorMessage);
      throw new Error(errorMessage, { cause: error });
    } finally {
      clearInterval(waitLogInterval);
    }
  }

  /**
   * Releases a system-wide mutex lock held by this process.
   *
   * @param lockName - The lock to release
   */
  static async releaseLock(lockName: MutexLockName): Promise<void> {
    const release = MutexService.#lockReleases.get(lockName);
    if (!release) {
      DR.logger.info(`No "${lockName}" lock to release`);
      return;
    }

    DR.logger.info(`Releasing the "${lockName}" mutex lock...`);
    // Dropped before the release is attempted, so a failed release cannot leave
    // this process believing it still holds the lock
    MutexService.#lockReleases.delete(lockName);

    try {
      await release();
    } catch (error) {
      throw new Error(
        `Failed to release the "${lockName}" mutex lock, which stays held until it goes stale: ${String(error)}`,
        { cause: error }
      );
    }

    DR.logger.info(`Successfully released the "${lockName}" mutex lock`);
  }

  /**
   * Checks if a lock is currently held by any process.
   *
   * @param lockName - The lock to check
   */
  static async isLocked(lockName: MutexLockName): Promise<boolean> {
    try {
      // Ensure lock directory exists before checking
      await MutexService.#ensureLockFileExists(lockName);
      const lockFilePath = await MutexService.#getLockFilePath(lockName);
      const result = await lockfile.check(lockFilePath);
      return result;
    } catch {
      // If file doesn't exist or other error, assume not locked
      return false;
    }
  }

  /**
   * Forces removal of a lock file. Use with caution!
   * This should only be used when you're certain no other process is using the lock.
   *
   * @param lockName - The lock to force release
   */
  static async forceReleaseLock(lockName: MutexLockName): Promise<void> {
    // First check if the lock is already available
    const isCurrentlyLocked = await MutexService.isLocked(lockName);
    if (!isCurrentlyLocked) {
      DR.logger.info(`Lock "${lockName}" is already available, no need to force release`);
      return;
    }

    try {
      DR.logger.warn(`Force releasing the "${lockName}" mutex lock...`);
      const lockFilePath = await MutexService.#getLockFilePath(lockName);
      await lockfile.unlock(lockFilePath);
      MutexService.#lockReleases.delete(lockName);
      DR.logger.info(`Successfully force released the "${lockName}" mutex lock`);
    } catch (error) {
      // If lockfile.unlock fails, try to manually remove the lock file
      try {
        const lockFilePath = await MutexService.#getLockFilePath(lockName);
        const lockFileWithExt = `${lockFilePath}.lock`;
        await fs.remove(lockFileWithExt);
        MutexService.#lockReleases.delete(lockName);
        DR.logger.info(`Successfully manually removed the "${lockName}" mutex lock file`);
      } catch (manualRemovalError) {
        const errorMessage = `Failed to force release the "${lockName}" mutex lock via both unlock and manual removal: ${String(error)}, manual removal error: ${String(manualRemovalError)}`;
        DR.logger.error(errorMessage);
        throw new Error(errorMessage, { cause: manualRemovalError });
      }
    }
  }

  /**
   * Forces removal of every lock file, so a process that died while holding a
   * lock cannot block the next one indefinitely. Use with caution! This should generally only
   * be used in tests.
   */
  static async forceReleaseAllLocks(): Promise<void> {
    for (const lockName of Object.values(MutexLockName)) {
      await MutexService.forceReleaseLock(lockName);
    }
  }

  /**
   * Ensures the lock directory and file exist.
   *
   * @param lockName - The lock whose file has to exist
   */
  static async #ensureLockFileExists(lockName: MutexLockName): Promise<void> {
    // Ensure the directory exists
    const lockDir = await MutexService.#getLockDir();
    await fs.ensureDir(lockDir);

    // Ensure the lock file exists (proper-lockfile requires the file to exist)
    // This creates an empty file if it doesn't exist, or does nothing if it already exists
    const lockFilePath = await MutexService.#getLockFilePath(lockName);
    await fs.ensureFile(lockFilePath);
  }

  /**
   * Gets the lock directory path from configuration.
   */
  static async #getLockDir(): Promise<string> {
    return await ConfigService.getDataDirectoryPath();
  }

  /**
   * Gets the path of the file backing a lock.
   *
   * @param lockName - The lock whose file path is needed
   */
  static async #getLockFilePath(lockName: MutexLockName): Promise<string> {
    const lockDir = await this.#getLockDir();
    return path.join(lockDir, lockName);
  }
}
