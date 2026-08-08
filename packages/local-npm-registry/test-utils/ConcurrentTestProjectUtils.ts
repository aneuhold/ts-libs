import { randomUUID } from 'crypto';
import { execa } from 'execa';
import path from 'path';
import { TestProjectUtils } from './TestProjectUtils.js';

/**
 * Test utilities for the behavior that only appears between separate processes.
 *
 * The store lock is the first thing that needed this. A second acquisition
 * inside one process is handed the lock that process already holds, so nothing
 * running in a single Vitest worker can contend for it. Vitest isolates test
 * files rather than individual tests, and Node's only other option is worker
 * threads, which share a pid and therefore share the lock. Real child processes
 * are the only way to reach it.
 *
 * A run stays timing dependent even with the workers waiting for each other, so
 * treat a passing result as evidence rather than proof.
 */
export class ConcurrentTestProjectUtils {
  static readonly #EXECUTABLES_DIRECTORY_NAME = 'concurrent-executables';

  static readonly #RUNNER_FILE_NAME = 'concurrentRunner.ts';

  /**
   * Runs one executable from `concurrent-executables` in the given number of
   * processes at once, and resolves once every one of them has finished.
   *
   * Each worker reaches the executable only after every other worker is ready,
   * so whatever the executable does happens at the same moment across the run
   * rather than however far apart process startup put them. Write the
   * executable as though it were the only one, and assert on whatever it left
   * behind once this resolves.
   *
   * @param executableFileName - File in `concurrent-executables` each worker runs
   * @param workerCount - How many processes to run it in
   * @param args - Handed to every worker, for whatever it needs that the test knows and it does not
   */
  static async runConcurrently(
    executableFileName: string,
    workerCount: number,
    args: string[] = []
  ): Promise<void> {
    // Named per run so a test can call this more than once
    const rendezvousDirectory = path.join(
      TestProjectUtils.getTestInstanceDir(),
      `rendezvous-${randomUUID().slice(0, 8)}`
    );
    const workerIndexes = Array.from({ length: workerCount }, (_, index) => index);

    const runs = await Promise.allSettled(
      workerIndexes.map((workerIndex) =>
        execa(
          ConcurrentTestProjectUtils.#getTsxBinaryPath(),
          [
            ConcurrentTestProjectUtils.#getRunnerPath(),
            ConcurrentTestProjectUtils.#getExecutablePath(executableFileName),
            rendezvousDirectory,
            String(workerIndex),
            String(workerCount),
            ...args
          ],
          { cwd: TestProjectUtils.getTestInstanceDir() }
        )
      )
    );

    // Every worker is reported rather than only the first, so a run that failed
    // several ways at once says so
    const failures = runs.flatMap((run, workerIndex) =>
      run.status === 'rejected' ? [`  worker ${workerIndex}: ${String(run.reason)}`] : []
    );

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} of ${workerCount} concurrent workers failed:\n${failures.join('\n')}`
      );
    }
  }

  /**
   * Resolves the coordinator every worker is started through.
   */
  static #getRunnerPath(): string {
    return path.join(__dirname, ConcurrentTestProjectUtils.#RUNNER_FILE_NAME);
  }

  /**
   * Resolves an executable by its file name.
   *
   * @param executableFileName - File in `concurrent-executables` to resolve
   */
  static #getExecutablePath(executableFileName: string): string {
    return path.join(
      __dirname,
      ConcurrentTestProjectUtils.#EXECUTABLES_DIRECTORY_NAME,
      executableFileName
    );
  }

  /**
   * Resolves the runner that loads the TypeScript sources in a child process.
   */
  static #getTsxBinaryPath(): string {
    return path.join(__dirname, '..', 'node_modules', '.bin', 'tsx');
  }
}
