import type { ApiKey, User } from '@aneuhold/core-ts-db-lib';
import type { DashboardConfig } from './DashboardConfig.js';

/**
 * Interface representing the input to the AuthValidateUser function.
 */
export interface AuthValidateUserInput {
  /**
   * The username of the user to be validated.
   */
  userName: string;
  /**
   * The password of the user to be validated.
   */
  password: string;
}

/**
 * Interface representing the output of the AuthValidateUser function.
 */
export interface AuthValidateUserOutput {
  /**
   * Information about the authenticated user.
   */
  userInfo?: {
    user: User;
    apiKey: ApiKey;
  };
  /**
   * Basic configuration for the projects that the user has access to.
   */
  config?: {
    dashboard?: DashboardConfig;
  };
}
