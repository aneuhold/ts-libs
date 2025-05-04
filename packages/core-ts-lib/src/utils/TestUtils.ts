/**
 * Utility class used for testing purposes.
 */
export default class TestUtils {
  private static consoleLoggers = {
    error: console.error,
    log: console.log,
    info: console.info,
    warn: console.warn
  };

  /**
   * Suppresses the console output of all console loggers (error, log, info, etc.).
   * Use `restoreConsole` when the test is finished to restore the console.
   */
  public static suppressConsole() {
    console.error = () => {};
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
  }

  /**
   * Restores the normal console output functionality of all console loggers
   * (error, log, info, etc.).
   */
  public static restoreConsole() {
    console.error = TestUtils.consoleLoggers.error;
    console.log = TestUtils.consoleLoggers.log;
    console.info = TestUtils.consoleLoggers.info;
    console.warn = TestUtils.consoleLoggers.warn;
  }
}
