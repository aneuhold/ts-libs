/**
 * Generic for API responses for personal APIs.
 */
export type APIResponse<T> = {
  success: boolean;
  errors: string[];
  data: T;
};
