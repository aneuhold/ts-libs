import { DR } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import path from 'path';
import lockfile from 'proper-lockfile';
import { ConfigService } from './Config.service.js';

/**
 * Service to manage the system-wide mutex lock, which is what makes one command
 * at a time change anything.
 
 * Commands therefore wait on each other for as long as an install takes, which
 * is the intended cost: acquisition waits however long it takes and reports
 * progress while it does.
 *
 * Note that cleanup is setup automatically via the proper-lockfile library if
 * the process exits unexpectedly.
 */
export class MutexService {
  static readonly #LOCK_FILE_NAME = 'local-npm-lock';

  static readonly #LOCK_CHECK_INTERVAL = 100;

  /**
   * Interval between the log lines that report how long the lock has been waited on.
   */
  static readonly #WAIT_LOG_INTERVAL = 5000;

  static #lockRelease: (() => Promise<void>) | null = null;

  /**
   * Runs an operation while holding the lock, releasing it however the
   * operation ends.
   *
   * @param operation - Runs while the lock is held
   */
  static async withLock<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    await MutexService.acquireLock();

    try {
      return await operation();
    } finally {
      await MutexService.releaseLock();
    }
  }

  /**
   * Acquires the lock, waiting until it is available.
   */
  static async acquireLock(): Promise<void> {
    if (MutexService.#lockRelease) {
      DR.logger.info('Lock already acquired by this process');
      return;
    }

    // proper-lockfile exposes no per-retry hook, so progress while waiting is
    // reported from here.
    const waitStart = Date.now();
    const waitLogInterval = setInterval(() => {
      const elapsedSeconds = Math.round((Date.now() - waitStart) / 1000);
      DR.logger.info(`Still waiting for the lock after ${elapsedSeconds}s...`);
    }, MutexService.#WAIT_LOG_INTERVAL);

    try {
      DR.logger.info('Attempting to acquire the mutex lock...');

      // Use proper-lockfile's built-in retry mechanism. `stale` is left as the default which is
      // 10 seconds.
      MutexService.#lockRelease = await lockfile.lock(await MutexService.#ensureLockFilePath(), {
        retries: {
          // Wait for the holder however long it takes. Some installs can take a very long time.
          forever: true,
          factor: 1, // No exponential backoff
          minTimeout: MutexService.#LOCK_CHECK_INTERVAL, // Wait between retries
          maxTimeout: MutexService.#LOCK_CHECK_INTERVAL, // Keep constant interval
          randomize: false // No jitter
        }
      });

      DR.logger.info('Successfully acquired the mutex lock');
    } catch (error) {
      const errorMessage = `Failed to acquire the mutex lock: ${String(error)}`;
      DR.logger.error(errorMessage);
      throw new Error(errorMessage, { cause: error });
    } finally {
      clearInterval(waitLogInterval);
    }
  }

  /**
   * Releases the lock held by this process.
   */
  static async releaseLock(): Promise<void> {
    const release = MutexService.#lockRelease;
    if (!release) {
      DR.logger.info('No lock to release');
      return;
    }

    DR.logger.info('Releasing the mutex lock...');
    // Dropped before the release is attempted, so a failed release cannot leave
    // this process believing it still holds the lock
    MutexService.#lockRelease = null;

    try {
      await release();
    } catch (error) {
      throw new Error(
        `Failed to release the mutex lock, which stays held until it goes stale: ${String(error)}`,
        { cause: error }
      );
    }

    DR.logger.info('Successfully released the mutex lock');
  }

  /**
   * Checks if the lock is currently held by any process.
   */
  static async isLocked(): Promise<boolean> {
    try {
      return await lockfile.check(await MutexService.#ensureLockFilePath());
    } catch {
      // If file doesn't exist or other error, assume not locked
      return false;
    }
  }

  /**
   * Forces removal of the lock file. Use with caution! This should only be used
   * when you're certain no other process is using the lock, and generally only
   * in tests.
   */
  static async forceReleaseLock(): Promise<void> {
    if (!(await MutexService.isLocked())) {
      DR.logger.info('Lock is already available, no need to force release');
      return;
    }

    const lockFilePath = await MutexService.#ensureLockFilePath();

    try {
      DR.logger.warn('Force releasing the mutex lock...');
      await lockfile.unlock(lockFilePath);
      MutexService.#lockRelease = null;
      DR.logger.info('Successfully force released the mutex lock');
    } catch (error) {
      // If lockfile.unlock fails, try to manually remove the lock file
      try {
        await fs.remove(`${lockFilePath}.lock`);
        MutexService.#lockRelease = null;
        DR.logger.info('Successfully manually removed the mutex lock file');
      } catch (manualRemovalError) {
        const errorMessage = `Failed to force release the mutex lock via both unlock and manual removal: ${String(error)}, manual removal error: ${String(manualRemovalError)}`;
        DR.logger.error(errorMessage);
        throw new Error(errorMessage, { cause: manualRemovalError });
      }
    }
  }

  /**
   * The path of the file backing the lock, which proper-lockfile requires to
   * exist before it can be locked.
   */
  static async #ensureLockFilePath(): Promise<string> {
    const lockFilePath = path.join(
      await ConfigService.getDataDirectoryPath(),
      MutexService.#LOCK_FILE_NAME
    );
    await fs.ensureFile(lockFilePath);
    return lockFilePath;
  }
}
