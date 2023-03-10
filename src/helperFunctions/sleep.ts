/**
 * Sleeps for the given amount of milliseconds, and resolves once finished.
 *
 * @param ms the number of milliseconds to sleep
 */
export default function sleep(ms: number): Promise<void> {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((resolve) => setTimeout(resolve, ms));
}
