import fs from 'fs-extra';
import path from 'path';
import { pathToFileURL } from 'url';
import type { ConcurrentWorker } from './ConcurrentWorker.js';

/**
 * Runs one worker of a concurrent run, holding it at a rendezvous until every
 * other worker has arrived.
 *
 * Every worker goes through here rather than being spawned directly, so no
 * executable has to implement the coordination itself. Process startup varies
 * by hundreds of milliseconds, which is long enough for one worker to finish
 * before another begins, and a run where the workers never overlap proves
 * nothing about what happens when they do.
 *
 * Usage:
 * `tsx concurrentRunner.ts <executablePath> <rendezvousDirectory> <workerIndex> <workerCount> [...args]`
 */

const RENDEZVOUS_POLL_MS = 10;

const RENDEZVOUS_TIMEOUT_MS = 30000;

/**
 * Announces this worker and waits until every other one has announced itself.
 *
 * @param rendezvousDirectory - Where the workers of this run announce themselves
 * @param workerIndex - Names this worker's announcement, so each one counts once
 * @param workerCount - How many workers have to arrive before any of them starts
 */
const waitForEveryWorker = async (
  rendezvousDirectory: string,
  workerIndex: number,
  workerCount: number
): Promise<void> => {
  await fs.ensureDir(rendezvousDirectory);
  await fs.writeFile(path.join(rendezvousDirectory, String(workerIndex)), '');

  const deadline = Date.now() + RENDEZVOUS_TIMEOUT_MS;
  let arrived = (await fs.readdir(rendezvousDirectory)).length;

  while (arrived < workerCount) {
    if (Date.now() > deadline) {
      throw new Error(
        `Only ${arrived} of ${workerCount} workers reached the rendezvous within ${RENDEZVOUS_TIMEOUT_MS}ms`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, RENDEZVOUS_POLL_MS));
    arrived = (await fs.readdir(rendezvousDirectory)).length;
  }
};

/**
 * Narrows a loaded executable to one that can be run as a worker.
 *
 * @param value - The loaded module
 */
const exportsConcurrentWorker = (value: unknown): value is { default: ConcurrentWorker } =>
  typeof value === 'object' &&
  value !== null &&
  'default' in value &&
  typeof value.default === 'function';

const [executablePath, rendezvousDirectory, workerIndex, workerCount, ...args] =
  process.argv.slice(2);

if (!executablePath || !rendezvousDirectory || !workerIndex || !workerCount) {
  throw new Error(
    'Usage: concurrentRunner.ts <executablePath> <rendezvousDirectory> <workerIndex> <workerCount> [...args]'
  );
}

const executable: unknown = await import(pathToFileURL(executablePath).href);

if (!exportsConcurrentWorker(executable)) {
  throw new Error(`${executablePath} has to default export a ConcurrentWorker`);
}

await waitForEveryWorker(rendezvousDirectory, Number(workerIndex), Number(workerCount));

await executable.default({
  workerIndex: Number(workerIndex),
  workerCount: Number(workerCount),
  args
});
