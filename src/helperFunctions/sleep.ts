/**
 * Sleeps for the given amount of milliseconds, and resolves once finished.
 *
 * @param ms the number of milliseconds to sleep
 * @returns
 */
export default function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
