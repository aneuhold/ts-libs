/**
 * Defines the structure of a span object used for tracing.
 * This is a minimal interface to avoid dependency on specific tracing libraries.
 */
export interface ISpan {
  /**
   * Sets the status of the span.
   *
   * @param status - An object containing a code and message.
   * @param status.code - The status code. Common codes: 1 (OK), 2 (Error/Internal), etc.
   * @param status.message - A human-readable message describing the status.
   */
  setStatus(status: { code: number; message: string }): void;
  // Add other methods you might need from the span, e.g., recordError, end
}

/**
 * Interface for a tracing service.
 */
export interface ITracer {
  /**
   * Starts a new span for tracing an operation.
   *
   * @param name - The name of the operation/span.
   * @param callback - The asynchronous function to execute within the span.
   *                   It receives the span object as an argument.
   * @returns A promise that resolves with the result of the callback.
   */
  startSpan<T>(name: string, callback: (span?: ISpan) => Promise<T>): Promise<T>;

  /**
   * Captures an exception for reporting.
   *
   * @param exception - The error or exception object.
   */
  captureException(exception: unknown): void;

  /**
   * Captures a message for reporting.
   *
   * @param message - The message string.
   * @param level - Optional severity level (e.g., 'info', 'warning', 'error').
   */
  captureMessage(message: string, level?: string): void;

  /**
   * Flushes any buffered trace events.
   * Important for short-lived environments like serverless functions.
   *
   * @param timeout - Optional timeout in milliseconds.
   * @returns A promise resolving to true if flush finished within timeout.
   */
  flush(timeout?: number): Promise<boolean>;

  /**
   * Checks if the tracer is enabled and configured.
   *
   * @returns True if the tracer is active, false otherwise.
   */
  isEnabled(): boolean;
}

/**
 * A tracer implementation that performs no operations.
 * Useful as a default or in environments where tracing is disabled.
 */
export class NoopTracer implements ITracer {
  /**
   * Executes the callback directly without creating a real span.
   *
   * @param _name - The name of the operation (unused).
   * @param callback - The asynchronous function to execute.
   */
  async startSpan<T>(_name: string, callback: (span?: ISpan) => Promise<T>): Promise<T> {
    // Provide a dummy span object that does nothing
    const noopSpan: ISpan = {
      setStatus: () => {}
    };
    return callback(noopSpan);
  }

  /** Does nothing. */
  captureException(): void {}

  /** Does nothing. */
  captureMessage(): void {}

  /** Returns true immediately. */
  flush(): Promise<boolean> {
    return Promise.resolve(true);
  }

  /** Returns false. */
  isEnabled(): boolean {
    return false;
  }
}
