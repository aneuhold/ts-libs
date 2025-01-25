/**
 * A standard logger that can be used to log messages to the console.
 */
export default class Logger {
  /**
   * Indicates if verbose logging is enabled.
   */
  public static verboseLoggingEnabled = false;

  /**
   * Private variable that sets if any logging on this instance of the Log
   * should only log if the `verboseLoggingEnabled` is set to true.
   */
  private logOnlyIfVerbose = false;

  /**
   * Creates an instance of Logger.
   *
   * @param logOnlyIfVerbose - If true, logging will only occur if verbose logging is enabled.
   */
  constructor(logOnlyIfVerbose?: boolean) {
    if (logOnlyIfVerbose) {
      this.logOnlyIfVerbose = logOnlyIfVerbose;
    }
  }

  /**
   * Sets the logging of the next chained function to only be activated
   * if verbose logging is turned on.
   *
   * @returns A new Logger instance with verbose logging enabled.
   */
  static get verbose(): Logger {
    return new Logger(true);
  }

  /**
   * Logs info to the console. Prepends `ℹ️` to each message.
   *
   * @param msg - The message to log.
   * @param skipNewline - If true, the message will be logged without a newline.
   */
  info(msg: string, skipNewline?: boolean): void {
    if (this.shouldLog()) {
      const printMessage = `ℹ️  ${msg}`;
      if (skipNewline) {
        process.stdout.write(printMessage);
      } else {
        console.log(printMessage);
      }
    }
  }

  /**
   * Static version of {@link Logger.prototype.info}.
   *
   * @param msg - The message to log.
   * @param skipNewline - If true, the message will be logged without a newline.
   * @see Logger.prototype.info
   */
  static info(msg: string, skipNewline?: boolean): void {
    new Logger().info(msg, skipNewline);
  }

  /**
   * Logs a success message to the console. Prepends `✅` to each message.
   *
   * @param msg - The message to log.
   */
  success(msg: string): void {
    if (this.shouldLog()) {
      console.log(`✅ ${msg}`);
    }
  }

  /**
   * Static version of {@link Logger.prototype.success}.
   *
   * @param msg - The message to log.
   * @see Logger.prototype.success
   */
  static success(msg: string): void {
    new Logger().success(msg);
  }

  /**
   * Logs a failure message to the console. Prepends `🔴` to each message.
   *
   * See {@link error} for logging errors.
   *
   * This doesn't use a `console.error` entry. Just a `console.log` entry.
   *
   * @param msg - The message to log.
   */
  failure(msg: string): void {
    if (this.shouldLog()) {
      console.log(`🔴 ${msg}`);
    }
  }

  /**
   * Static version of {@link Logger.prototype.failure}.
   *
   * @param msg - The message to log.
   * @see Logger.prototype.failure
   */
  static failure(msg: string): void {
    new Logger().failure(msg);
  }

  /**
   * Logs an error message to the console. Only use this for errors that will
   * likely stop execution. Prepends `💀` to each message and uses `console.error`.
   *
   * See {@link failure} for logging simple failures.
   *
   * @param msg - The message to log.
   */
  error(msg: string): void {
    if (this.shouldLog()) {
      console.error(`💀 ${msg}`);
    }
  }

  /**
   * Static version of {@link Logger.prototype.error}.
   *
   * @param msg - The message to log.
   * @see Logger.prototype.error
   */
  static error(msg: string): void {
    new Logger().error(msg);
  }

  /**
   * Determines if the message should be logged based on the verbose logging settings.
   *
   * @returns True if the message should be logged, false otherwise.
   */
  private shouldLog(): boolean {
    if (!this.logOnlyIfVerbose || Logger.verboseLoggingEnabled) {
      return true;
    }
    return false;
  }
}
