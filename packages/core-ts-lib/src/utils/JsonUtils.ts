/**
 * Utility functions for safely parsing JSON content.
 */
export default class JsonUtils {
  /**
   * Parses JSON content and validates it against a type guard.
   *
   * @param content The JSON string to parse.
   * @param guard A type guard that verifies the parsed value matches the expected shape.
   * @param errorMessage Optional error message used when validation fails.
   */
  static parseWithGuard<T>(
    content: string,
    guard: (value: unknown) => value is T,
    errorMessage = 'Parsed JSON does not match the expected shape.'
  ): T {
    const parsed: unknown = JSON.parse(content);
    if (!guard(parsed)) {
      throw new Error(errorMessage);
    }
    return parsed;
  }
}
