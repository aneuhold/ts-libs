/**
 * What a file in `concurrent-executables` has to default export.
 *
 * The runner calls it once the worker has met every other worker, so anything
 * it does is already in step with its fellows.
 */
export type ConcurrentWorker = (context: ConcurrentWorkerContext) => Promise<void>;

/**
 * What one worker is told about the run it is part of.
 */
export type ConcurrentWorkerContext = {
  /** Position of this worker in the run, counted from zero */
  workerIndex: number;
  /** How many workers the run started */
  workerCount: number;
  /** Whatever the caller handed to every worker */
  args: string[];
};
