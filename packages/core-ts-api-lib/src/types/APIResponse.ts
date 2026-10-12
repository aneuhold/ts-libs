import type { APIErrorCode } from './APIErrorCode.js';

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
  /** The HTTP status code the response is sent with. */
  statusCode: number;
  /**
   * Names the specific failure. Set on every response where `success` is
   * `false`, and never on a success.
   */
  errorCode?: APIErrorCode;
  /** Array of human-readable error messages if the call failed */
  errors: string[];
  /** The typed data payload returned by the API */
  data: T;
};
