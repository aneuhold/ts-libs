/**
 * Codes naming the specific failure behind an unsuccessful {@link APIResponse},
 * shared by every project. Each code documents the HTTP status it is sent with.
 *
 * A project's own codes go in their own enum export (e.g. `WorkoutAPIErrorCode`).
 */
export enum APIErrorCode {
  /** 401: The access token is missing, invalid, or expired. */
  Unauthorized = 'Unauthorized',
  /** 401: The refresh token is invalid or expired, or its user no longer exists. */
  InvalidRefreshToken = 'InvalidRefreshToken',
  /** 400: `validateUser` got neither a Google credential token nor a username and password. */
  MissingCredentials = 'MissingCredentials',
  /** 403: The user has no access to the requested project. */
  NoProjectAccess = 'NoProjectAccess',
  /** 403: Any other refusal. */
  Forbidden = 'Forbidden',
  /** 4xx: Any other client error. */
  BadRequest = 'BadRequest',
  /** 5xx: An unexpected server error. */
  InternalError = 'InternalError',
  /**
   * Set by the client when the body was not a valid
   * {@link APIResponse} (e.g. an error page from Cloud Run).
   */
  InvalidAPIResponseShape = 'InvalidAPIResponseShape'
}
