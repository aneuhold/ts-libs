import { DR } from '@aneuhold/core-ts-lib';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import lockfile from 'proper-lockfile';
import { ConfigService } from './ConfigService.js';

/**
 * Service to manage system-wide mutex locks for Verdaccio registry instances.
 * This ensures only one process can run Verdaccio at a time across the entire system.
 *
 * Note that cleanup is setup automatically via the proper-lockfile library if
 * the process exits unexpectedly.
 */
export class MutexService {
  private static readonly LOCK_FILE_NAME = 'verdaccio-lock';
  /**
   * Default timeout for acquiring the lock in milliseconds.
   */
  private static readonly LOCK_TIMEOUT = 10000;
  private static readonly LOCK_CHECK_TIMEOUT = 500;

  private static lockRelease: (() => Promise<void>) | null = null;

  /**
   * Acquires a system-wide mutex lock for the Verdaccio registry.
   * This will block until the lock is available or timeout is reached.
   *
   * @param timeoutMs - Maximum time to wait for lock in milliseconds (default: 30 seconds)
   */
  static async acquireLock(
    timeoutMs: number = MutexService.LOCK_TIMEOUT
  ): Promise<void> {
    if (MutexService.lockRelease) {
      DR.logger.info('Lock already acquired by this process');
      return;
    }

    try {
      DR.logger.info('Attempting to acquire Verdaccio mutex lock...');

      // Ensure lock directory exists
      await MutexService.ensureLockFileExists();

      const lockFilePath = await MutexService.getLockFilePath();

      // Use proper-lockfile's built-in retry mechanism
      MutexService.lockRelease = await lockfile.lock(lockFilePath, {
        // Stale lock timeout - if a process crashes, the lock will be considered stale
        // after this time.
        stale: timeoutMs,
        // Use built-in retry mechanism with custom options
        retries: {
          retries: Math.floor(timeoutMs / MutexService.LOCK_CHECK_TIMEOUT), // Retry for the duration of timeout
          factor: 1, // No exponential backoff
          minTimeout: MutexService.LOCK_CHECK_TIMEOUT, // Wait between retries
          maxTimeout: MutexService.LOCK_CHECK_TIMEOUT, // Keep constant interval
          randomize: false // No jitter
        }
      });

      DR.logger.info('Successfully acquired Verdaccio mutex lock');
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
      const lockFilePath = await MutexService.getLockFilePath();
      const result = await lockfile.check(lockFilePath);
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
    // First check if the lock is already available
    const isCurrentlyLocked = await MutexService.isLocked();
    if (!isCurrentlyLocked) {
      DR.logger.info('Lock is already available, no need to force release');
      return;
    }

    try {
      DR.logger.warn('Force releasing Verdaccio mutex lock...');
      const lockFilePath = await MutexService.getLockFilePath();
      await lockfile.unlock(lockFilePath);
      MutexService.lockRelease = null;
      DR.logger.info('Successfully force released Verdaccio mutex lock');
    } catch (error) {
      // If lockfile.unlock fails, try to manually remove the lock file
      try {
        const lockFilePath = await MutexService.getLockFilePath();
        const lockFileWithExt = `${lockFilePath}.lock`;
        await fs.remove(lockFileWithExt);
        MutexService.lockRelease = null;
        DR.logger.info(
          'Successfully manually removed Verdaccio mutex lock file'
        );
      } catch (manualRemovalError) {
        const errorMessage = `Failed to force release mutex lock via both unlock and manual removal: ${String(error)}, manual removal error: ${String(manualRemovalError)}`;
        DR.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
    }
  }

  /**
   * Ensures the lock directory and file exist.
   */
  private static async ensureLockFileExists(): Promise<void> {
    // Ensure the directory exists
    const lockDir = await MutexService.getLockDir();
    await fs.ensureDir(lockDir);

    // Ensure the lock file exists (proper-lockfile requires the file to exist)
    // This creates an empty file if it doesn't exist, or does nothing if it already exists
    const lockFilePath = await MutexService.getLockFilePath();
    await fs.ensureFile(lockFilePath);
  }

  /**
   * Gets the lock directory path from configuration.
   */
  private static async getLockDir(): Promise<string> {
    const config = await ConfigService.loadConfig();
    const baseDirectory = config.dataDirectory || os.homedir();
    return path.join(baseDirectory, '.local-npm-registry');
  }

  /**
   * Gets the lock file path from configuration.
   */
  private static async getLockFilePath(): Promise<string> {
    const lockDir = await this.getLockDir();
    return path.join(lockDir, this.LOCK_FILE_NAME);
  }
}
