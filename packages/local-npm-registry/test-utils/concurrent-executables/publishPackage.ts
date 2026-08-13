import { PublishCommand } from '../../src/commands/PublishCommand.js';
import type { ConcurrentWorker } from '../ConcurrentWorker.js';

/**
 * Publishes the package in the directory this worker was given, the way a
 * watcher in that directory does.
 *
 * Two publishes only contend across processes: both take the store lock, start
 * the registry on one port, and rewrite whatever subscriber they share, none of
 * which a single process ever does twice at once.
 *
 * Args: one package directory per worker, in worker order.
 *
 * @param context - What this worker was told about the run it is part of
 */
const publishPackage: ConcurrentWorker = async (context) => {
  const { workerIndex, args } = context;
  const packagePath = args[workerIndex];

  if (!packagePath) {
    throw new Error(`publishPackage needs a package directory for worker ${workerIndex}`);
  }

  process.chdir(packagePath);

  await PublishCommand.execute();
};

export default publishPackage;
