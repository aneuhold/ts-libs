import fs from 'fs-extra';
import path from 'path';
import { PackageJsonService } from '../../src/services/PackageJson.service.js';
import type { ConcurrentWorker } from '../ConcurrentWorker.js';

/**
 * How many times the package.json is rewritten. Enough passes that a reader
 * lands mid-rewrite rather than between rewrites.
 */
const REWRITE_COUNT = 200;

const DONE_FILE_NAME = 'rewrites-done';

/**
 * Paced so the readers leave the machine to the rest of the suite. Reading flat
 * out starves whatever else is running, and it catches nothing this does not.
 */
const READ_INTERVAL_MS = 1;

/**
 * Rewrites a project's package.json in one process while every other process
 * reads it, which is what a package manager and Node's module resolution both
 * do to a subscriber while it is being updated.
 *
 * Worker zero does the rewriting. Every other worker parses the file until the
 * rewriting stops, and leaves the number of reads that did not parse in
 * `unreadable-<workerIndex>`, so a rewrite that is ever visible as a partial
 * file shows up as a count above zero.
 *
 * Args: the project directory holding the package.json, then the directory the
 * workers report into.
 *
 * @param context - What this worker was told about the run it is part of
 */
const readPackageJsonWhileRewritten: ConcurrentWorker = async (context) => {
  const { workerIndex, args } = context;
  const [projectPath, outputDirectory] = args;

  if (!projectPath || !outputDirectory) {
    throw new Error(
      'readPackageJsonWhileRewritten needs the project directory and the directory to report into'
    );
  }

  const donePath = path.join(outputDirectory, DONE_FILE_NAME);

  if (workerIndex === 0) {
    for (let index = 0; index < REWRITE_COUNT; index += 1) {
      await PackageJsonService.updateVersionField(projectPath, `1.0.${index}`);
    }
    await fs.writeFile(donePath, '');
    return;
  }

  const packageJsonPath = path.join(projectPath, 'package.json');
  let unreadableReads = 0;

  while (!(await fs.pathExists(donePath))) {
    try {
      JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    } catch {
      unreadableReads += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, READ_INTERVAL_MS));
  }

  await fs.writeFile(
    path.join(outputDirectory, `unreadable-${workerIndex}`),
    String(unreadableReads)
  );
};

export default readPackageJsonWhileRewritten;
