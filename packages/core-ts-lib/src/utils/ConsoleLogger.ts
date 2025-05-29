import { ILogger } from '../interfaces/ILogger.js';

/**
 * A standard logger that logs messages to the console.
 * Implements the ILogger interface.
 */
export default class ConsoleLogger implements ILogger {
  /**
   * Indicates if verbose logging is enabled globally.
   * Affects instances created via the `verbose` getter or constructor.
   */
  public static verboseLoggingEnabled = false;

  /**
   * Private flag indicating if this instance should only log when verbose mode is enabled.
   */
  private logOnlyIfVerbose = false;

  /**
   * Creates an instance of ConsoleLogger.
   *
   * @param logOnlyIfVerbose - If true, this instance will only log messages if
   *                           `ConsoleLogger.verboseLoggingEnabled` is also true.
   */
  constructor(logOnlyIfVerbose?: boolean) {
    if (logOnlyIfVerbose) {
      this.logOnlyIfVerbose = logOnlyIfVerbose;
    }
  }

  /**
   * Gets a new ConsoleLogger instance configured for verbose logging.
   * This instance will only log if `ConsoleLogger.verboseLoggingEnabled` is true.
   *
   * @returns A new ConsoleLogger instance set to log only when verbose mode is active.
   */
  get verbose(): ConsoleLogger {
    return new ConsoleLogger(true);
  }

  /**
   * Static getter for a verbose ConsoleLogger instance.
   * Equivalent to `new ConsoleLogger().verbose`.
   *
   * @returns A new ConsoleLogger instance set to log only when verbose mode is active.
   */
  static get verbose(): ConsoleLogger {
    return new ConsoleLogger(true);
  }

  /**
   * Logs info to the console. Prepends `ℹ️` to each message.
   * Respects the instance's `logOnlyIfVerbose` setting and the global `verboseLoggingEnabled` flag.
   *
   * @param msg - The message to log.
   * @param skipNewline - If true, the message will be logged without a newline.
   */
  info(msg: string, skipNewline?: boolean): void {
    if (this.shouldLog()) {
      const printMessage = `ℹ️  ${msg}`;
      if (
        skipNewline &&
        typeof process !== 'undefined' &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        process.stdout.write
      ) {
        // Check for process.stdout.write for Node.js compatibility
        process.stdout.write(printMessage);
      } else {
        console.log(printMessage);
      }
    }
  }

  /**
   * Static version of {@link ConsoleLogger.prototype.info}. Logs using a default instance.
   *
   * @param msg - The message to log.
   * @param skipNewline - If true, the message will be logged without a newline.
   */
  static info(msg: string, skipNewline?: boolean): void {
    new ConsoleLogger().info(msg, skipNewline);
  }

  /**
   * Logs a success message to the console. Prepends `✅` to each message.
   * Respects the instance's `logOnlyIfVerbose` setting and the global `verboseLoggingEnabled` flag.
   *
   * @param msg - The message to log.
   */
  success(msg: string): void {
    if (this.shouldLog()) {
      console.log(`✅ ${msg}`);
    }
  }

  /**
   * Static version of {@link ConsoleLogger.prototype.success}. Logs using a default instance.
   *
   * @param msg - The message to log.
   */
  static success(msg: string): void {
    new ConsoleLogger().success(msg);
  }

  /**
   * Logs a warning message to the console. Prepends `🟡` to each message.
   * Uses `console.warn`. See {@link error} for critical errors.
   * Respects the instance's `logOnlyIfVerbose` setting and the global `verboseLoggingEnabled` flag.
   *
   * @param msg - The message to log.
   */
  warn(msg: string): void {
    if (this.shouldLog()) {
      console.warn(`🟡 ${msg}`);
    }
  }

  /**
   * Static version of {@link ConsoleLogger.prototype.warn}. Logs using a default instance.
   *
   * @param msg - The message to log.
   */
  static warn(msg: string): void {
    new ConsoleLogger().warn(msg);
  }

  /**
   * Logs an error message to the console using `console.error`. Prepends `💀`.
   * Use for potentially execution-stopping errors. See {@link warn} for non-critical issues.
   * Respects the instance's `logOnlyIfVerbose` setting and the global `verboseLoggingEnabled` flag.
   *
   * @param msg - The message to log.
   */
  error(msg: string): void {
    if (this.shouldLog()) {
      console.error(`💀 ${msg}`);
    }
  }

  /**
   * Static version of {@link ConsoleLogger.prototype.error}. Logs using a default instance.
   *
   * @param msg - The message to log.
   */
  static error(msg: string): void {
    new ConsoleLogger().error(msg);
  }

  /**
   * Determines if the message should be logged based on the instance's verbose setting
   * and the global verbose logging flag.
   *
   * @returns True if the message should be logged, false otherwise.
   */
  private shouldLog(): boolean {
    // Log if verbose logging is not required for this instance,
    // OR if verbose logging IS required AND it's globally enabled.
    return !this.logOnlyIfVerbose || ConsoleLogger.verboseLoggingEnabled;
  }
}
