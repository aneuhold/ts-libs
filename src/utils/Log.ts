class Log {
  public static verboseLoggingEnabled = false;

  /**
   * Private variable that sets if any logging on this instance of the Log
   * should only log if the `verboseLoggingEnabled` is set to true.
   */
  private logOnlyIfVerbose = false;

  constructor(logOnlyIfVerbose?: boolean) {
    if (logOnlyIfVerbose) {
      this.logOnlyIfVerbose = logOnlyIfVerbose;
    }
  }

  /**
   * Sets the logging of the next chained function to only be activated
   * if verbose logging is turned on.
   */
  static get verbose(): Log {
    return new Log(true);
  }

  /**
   * Logs info to the console. Prepends `ℹ️` to each message.
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
   * Static version of {@link Log.prototype.info}.
   *
   * @see Log.prototype.info
   */
  static info(msg: string, skipNewline?: boolean): void {
    new Log().info(msg, skipNewline);
  }

  /**
   * Logs a success message to the console. Prepends `✅` to each message.
   *
   * @param msg
   */
  success(msg: string): void {
    if (this.shouldLog()) {
      console.log(`✅ ${msg}`);
    }
  }

  /**
   * Static version of {@link Log.prototype.success}.
   *
   * @see Log.prototype.success
   */
  static success(msg: string): void {
    new Log().success(msg);
  }

  /**
   * Logs a failure message to the console. Prepends `🔴` to each message.
   *
   * See {@link error} for logging errors.
   *
   * This doesn't use a `console.error` entry. Just a `console.log` entry.
   * @param msg
   */
  failure(msg: string): void {
    if (this.shouldLog()) {
      console.log(`🔴 ${msg}`);
    }
  }

  /**
   * Static version of {@link Log.prototype.failure}.
   *
   * @see Log.prototype.failure
   */
  static failure(msg: string): void {
    new Log().failure(msg);
  }

  /**
   * Logs an error message to the console. Only use this for errors that will
   * likely stop execution. Prepends `💀` to each message and uses `console.error`.
   *
   * See {@link failure} for logging simple failures.
   *
   * @param msg
   */
  error(msg: string): void {
    if (this.shouldLog()) {
      console.error(`💀 ${msg}`);
    }
  }

  /**
   * Static version of {@link Log.prototype.error}.
   *
   * @see Log.prototype.error
   */
  static error(msg: string): void {
    new Log().error(msg);
  }

  private shouldLog(): boolean {
    if (
      !this.logOnlyIfVerbose ||
      (this.logOnlyIfVerbose && Log.verboseLoggingEnabled)
    ) {
      return true;
    }
    return false;
  }
}

export default Log;
