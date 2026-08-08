import { randomUUID } from 'crypto';
import { LocalPackageStoreService } from '../../src/services/LocalPackageStore.service.js';
import { MutexService } from '../../src/services/Mutex.service.js';
import { MutexLockName } from '../../src/types/MutexLockName.js';
import type { ConcurrentWorker } from '../ConcurrentWorker.js';

/**
 * How long the store lock is held once taken. Long enough that a missing lock
 * lets every worker read the same store and overwrite each other, short enough
 * that the run still finishes quickly.
 */
const LOCK_HOLD_MS = 150;

/**
 * Adds one package entry to the local package store, taking the store lock
 * across the read and the write the way a command does.
 *
 * Every worker writes under a name of its own, so a lost update shows up as a
 * store holding fewer entries than the run had workers. Nothing is published
 * and no package directory is created. The entry is only a key and a value in
 * the store file.
 *
 * Args: the package path every entry is stored under.
 *
 * @param context - What this worker was told about the run it is part of
 */
const writeStoreEntry: ConcurrentWorker = async (context) => {
  const { workerIndex, args } = context;
  const [packagePath] = args;

  if (!packagePath) {
    throw new Error('writeStoreEntry needs the package path to store entries under');
  }

  const packageName = `@test-${randomUUID().slice(0, 8)}/concurrent-writer-${workerIndex}`;

  await MutexService.withLock(MutexLockName.Store, async () => {
    const store = await LocalPackageStoreService.getStore();

    // Held so the workers genuinely overlap. Without this the read and the
    // write are a millisecond apart and they can queue through the lock without
    // ever contending for it
    await new Promise((resolve) => setTimeout(resolve, LOCK_HOLD_MS));

    LocalPackageStoreService.updatePackageEntry(store, packageName, packagePath, {
      originalVersion: '1.0.0',
      currentVersion: '1.0.0',
      subscribers: []
    });
    await LocalPackageStoreService.writeStore(store);
  });
};

export default writeStoreEntry;
