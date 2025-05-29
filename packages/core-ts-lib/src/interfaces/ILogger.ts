/**
 * Interface for a standard logger service.
 */
export interface ILogger {
  /**
   * Logs informational messages.
   *
   * @param msg - The message to log.
   * @param skipNewline - Optional. If true, does not append a newline.
   */
  info(msg: string, skipNewline?: boolean): void;

  /**
   * Logs success messages.
   *
   * @param msg - The message to log.
   */
  success(msg: string): void;

  /**
   * Logs warning messages (non-critical).
   *
   * @param msg - The message to log.
   */
  warn(msg: string): void;

  /**
   * Logs error messages (potentially critical).
   *
   * @param msg - The message to log.
   */
  error(msg: string): void;

  /**
   * Gets a logger instance configured for verbose logging.
   * Implementations should return an ILogger that only logs
   * when verbose mode is enabled globally.
   */
  get verbose(): ILogger;
}

/**
 * A logger implementation that performs no operations.
 * Useful as a default or in environments where logging is disabled.
 */
export class NoopLogger implements ILogger {
  info(): void {}
  success(): void {}
  warn(): void {}
  error(): void {}
  get verbose(): ILogger {
    // Return itself, as it does nothing anyway
    return this;
  }
}
