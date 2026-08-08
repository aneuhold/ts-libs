import { LocalPackageStoreService } from '../src/services/LocalPackageStore.service.js';
import { MutexService } from '../src/services/Mutex.service.js';
import { VerdaccioService } from '../src/services/Verdaccio.service.js';
import { TestProjectUtils } from './TestProjectUtils.js';

/**
 * Global setup function that runs once before all test suites.
 * Sets up the global temporary directory and ensures clean mutex state.
 */
export async function setup(): Promise<void> {
  // Ensure no mutex lock exists before starting tests
  try {
    await MutexService.forceReleaseAllLocks();
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
    await MutexService.forceReleaseAllLocks();

    const testPackagePattern = /^@test-[a-fA-F0-9]{8}\//;
    await TestProjectUtils.mutateStore((store) =>
      LocalPackageStoreService.removePackagesByPattern(store, testPackagePattern)
    );
  } catch {
    // Ignore errors during cleanup
  }
}
