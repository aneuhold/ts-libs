/**
 * What the tests read from Vitest itself, as opposed to from the tool under
 * test.
 */
export class VitestUtils {
  /** What Vitest numbers the worker a spec file runs in with, from one to the worker count */
  static readonly #WORKER_ID_ENVIRONMENT_VARIABLE = 'VITEST_POOL_ID';

  /**
   * The worker a spec file runs in, which Vitest numbers from one and reuses
   * for the files that run in it one after another. It is 0 outside a Vitest
   * worker, which is where nothing else is running to collide with.
   */
  static getWorkerId(): number {
    const workerId = Number(process.env[VitestUtils.#WORKER_ID_ENVIRONMENT_VARIABLE]);

    return Number.isInteger(workerId) ? workerId : 0;
  }
}
