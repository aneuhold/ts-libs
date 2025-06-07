import { LocalPackageStoreService } from '../src/services/LocalPackageStoreService.js';
import { MutexService } from '../src/services/MutexService.js';
import { VerdaccioService } from '../src/services/VerdaccioService.js';

/**
 * Global setup function that runs once before all test suites.
 * Sets up the global temporary directory and ensures clean mutex state.
 */
export async function setup(): Promise<void> {
  // Ensure no mutex lock exists before starting tests
  try {
    await MutexService.forceReleaseLock();
  } catch {
    // Ignore errors if no lock exists
  }
}

/**
 * Global teardown function that runs once after all test suites.
 */
export async function teardown(): Promise<void> {
  // Clean up any remaining mutex lock and stop Verdaccio service
  try {
    await VerdaccioService.stop();
    await MutexService.forceReleaseLock();

    const testPackagePattern = /^@test-[a-fA-F0-9]{8}\//;
    await LocalPackageStoreService.removePackagesByPattern(testPackagePattern);
  } catch {
    // Ignore errors during cleanup
  }
}
