import type { ApiKey, User } from '@aneuhold/core-ts-db-lib';
import type { DashboardConfig } from './project/dashboard/DashboardConfig.js';

/**
 * Interface representing the input to the AuthValidateUser endpoint.
 */
export interface AuthValidateUserInput {
  /** The username of the user to be validated (password flow). */
  userName?: string;
  /** The password of the user to be validated (password flow). */
  password?: string;
  /** Google ID token received from Google Identity Services (Google flow). */
  googleCredentialToken?: string;
}

/**
 * Interface representing the output of the AuthValidateUser endpoint.
 */
export interface AuthValidateUserOutput {
  /**
   * Information about the authenticated user.
   */
  userInfo?: {
    user: User;
    apiKey: ApiKey;
  };
  /** JWT access token for authenticating API requests. */
  accessToken?: string;
  /** Raw refresh token string for obtaining new access tokens. */
  refreshTokenString?: string;
  /**
   * Basic configuration for the projects that the user has access to.
   */
  config?: {
    dashboard?: DashboardConfig;
  };
}
