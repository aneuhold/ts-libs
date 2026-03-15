/**
 * Interface representing the input to the auth refresh token endpoint.
 */
export interface AuthRefreshTokenInput {
  /** The raw refresh token string to exchange for new tokens. */
  refreshTokenString: string;
}

/**
 * Interface representing the output of the auth refresh token endpoint.
 */
export interface AuthRefreshTokenOutput {
  /** New JWT access token. */
  accessToken: string;
  /** New raw refresh token string (rotation — old one is deleted). */
  refreshTokenString: string;
}
