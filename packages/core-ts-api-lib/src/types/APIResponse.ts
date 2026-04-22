/**
 * Generic type for API responses in personal projects.
 *
 * Provides a consistent structure for all API responses with success status,
 * error messages, and typed data payload.
 *
 * @template T - The type of data contained in the response.
 */
export type APIResponse<T> = {
  /** Indicates whether the API call was successful */
  success: boolean;
  /** Array of error messages if the call failed */
  errors: string[];
  /** The typed data payload returned by the API */
  data: T;
};
