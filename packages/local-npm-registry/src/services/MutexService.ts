import { DR } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import lockfile from 'proper-lockfile';

/**
 * Service to manage system-wide mutex locks for Verdaccio registry instances.
 * This ensures only one process can run Verdaccio at a time across the entire system.
 */
export class MutexService {
  private static readonly LOCK_FILE_NAME = 'verdaccio-registry';
  private static readonly LOCK_DIR = path.join(
    os.tmpdir(),
    'local-npm-registry'
  );
  private static readonly LOCK_FILE_PATH = path.join(
    MutexService.LOCK_DIR,
    MutexService.LOCK_FILE_NAME
  );

  private static lockRelease: (() => Promise<void>) | null = null;

  /**
   * Acquires a system-wide mutex lock for the Verdaccio registry.
   * This will block until the lock is available or timeout is reached.
   *
   * @param timeoutMs - Maximum time to wait for lock in milliseconds (default: 30 seconds)
   */
  static async acquireLock(timeoutMs: number = 30000): Promise<void> {
    if (MutexService.lockRelease) {
      DR.logger.info('Lock already acquired by this process');
      return;
    }

    try {
      DR.logger.info('Attempting to acquire Verdaccio mutex lock...');

      // Ensure lock directory exists
      await MutexService.ensureLockFileExists();

      const startTime = Date.now();
      const retryInterval = 1000; // Check every second

      while (Date.now() - startTime < timeoutMs) {
        try {
          // Attempt to acquire the lock
          MutexService.lockRelease = await lockfile.lock(
            MutexService.LOCK_FILE_PATH,
            {
              // Stale lock timeout - if a process crashes, the lock will be considered stale after 60 seconds
              stale: 60000,
              // Don't throw if already locked, we'll handle the retry logic
              retries: 0
            }
          );

          DR.logger.info('Successfully acquired Verdaccio mutex lock');
          return;
        } catch (error) {
          if (error instanceof Error && error.message.includes('ELOCKED')) {
            // Lock is held by another process, wait and retry
            DR.logger.info(
              `Lock is held by another process, retrying in ${retryInterval}ms...`
            );
            await MutexService.sleep(retryInterval);
            continue;
          }
          // Other error, rethrow
          throw error;
        }
      }

      // Timeout reached
      throw new Error(
        `Failed to acquire Verdaccio mutex lock within ${timeoutMs}ms. ` +
          'Another process may be running Verdaccio.'
      );
    } catch (error) {
      const errorMessage = `Failed to acquire mutex lock: ${String(error)}`;
      DR.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Releases the system-wide mutex lock for the Verdaccio registry.
   */
  static async releaseLock(): Promise<void> {
    if (!MutexService.lockRelease) {
      DR.logger.info('No lock to release');
      return;
    }

    try {
      DR.logger.info('Releasing Verdaccio mutex lock...');
      await MutexService.lockRelease();
      MutexService.lockRelease = null;
      DR.logger.info('Successfully released Verdaccio mutex lock');
    } catch (error) {
      const errorMessage = `Failed to release mutex lock: ${String(error)}`;
      DR.logger.error(errorMessage);
      // Don't throw here as we want to continue cleanup even if lock release fails
    }
  }

  /**
   * Checks if a lock is currently held by any process.
   */
  static async isLocked(): Promise<boolean> {
    try {
      // Ensure lock directory exists before checking
      await MutexService.ensureLockFileExists();
      const result = await lockfile.check(MutexService.LOCK_FILE_PATH);
      return result;
    } catch {
      // If file doesn't exist or other error, assume not locked
      return false;
    }
  }

  /**
   * Forces removal of the lock file. Use with caution!
   * This should only be used when you're certain no other process is using the lock.
   */
  static async forceReleaseLock(): Promise<void> {
    try {
      DR.logger.warn('Force releasing Verdaccio mutex lock...');
      await lockfile.unlock(MutexService.LOCK_FILE_PATH);
      MutexService.lockRelease = null;
      DR.logger.info('Successfully force released Verdaccio mutex lock');
    } catch (error) {
      const errorMessage = `Failed to force release mutex lock: ${String(error)}`;
      DR.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Ensures the lock directory and file exist.
   */
  private static async ensureLockFileExists(): Promise<void> {
    // Ensure the directory exists
    await fs.ensureDir(MutexService.LOCK_DIR);

    // Ensure the lock file exists (proper-lockfile requires the file to exist)
    // This creates an empty file if it doesn't exist, or does nothing if it already exists
    await fs.ensureFile(MutexService.LOCK_FILE_PATH);
  }

  /**
   * Sleep utility function.
   *
   * @param ms - The number of milliseconds to sleep
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
