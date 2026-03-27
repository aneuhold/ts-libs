import type { AdminInput, AdminOutput } from '../../types/Admin.js';
import type { APIResponse } from '../../types/APIResponse.js';
import type {
  AuthValidateUserInput,
  AuthValidateUserOutput
} from '../../types/AuthValidateUser.js';
import type {
  ProjectDashboardInput,
  ProjectDashboardOutput
} from '../../types/project/dashboard/ProjectDashboard.js';
import type {
  ProjectWorkoutPrimaryInput,
  ProjectWorkoutPrimaryOutput
} from '../../types/project/workout/ProjectWorkout.js';
import GCloudAPIService from '../GCloudAPIService/GCloudAPIService.js';

/**
 * A service for making calls to the backend API for personal projects. This is
 * abstracted so that the backend implementation can change over time.
 */
export default class APIService {
  /**
   * Validates the provided credentials against the database and returns the
   * user's information if successful. Supports both password and Google
   * sign-in flows.
   *
   * @param input - The input containing credentials (username/password or Google credential token).
   */
  static async validateUser(
    input: AuthValidateUserInput
  ): Promise<APIResponse<AuthValidateUserOutput>> {
    return GCloudAPIService.authValidateUser(input);
  }

  /**
   * Logs out the current session by deleting the stored refresh token
   * server-side.
   */
  static async logout(): Promise<APIResponse<undefined>> {
    return GCloudAPIService.authLogout();
  }

  /**
   * Sets the JWT access token to attach to all API requests.
   *
   * @param token - The access token.
   */
  static setAccessToken(token: string): void {
    GCloudAPIService.setAccessToken(token);
  }

  /**
   * Sets the refresh token string used for automatic token refresh on 401.
   *
   * @param token - The refresh token string.
   */
  static setRefreshTokenString(token: string): void {
    GCloudAPIService.setRefreshTokenString(token);
  }

  /**
   * Registers a callback that is invoked after tokens are automatically
   * refreshed (e.g. to persist new tokens to localStorage).
   *
   * @param callback - The callback receiving the new accessToken and refreshTokenString.
   */
  static setOnTokensRefreshed(
    callback: ((accessToken: string, refreshTokenString: string) => void) | null
  ): void {
    GCloudAPIService.setOnTokensRefreshed(callback);
  }

  /**
   * Calls the dashboard API and returns the result.
   *
   * @param input - The input for the dashboard API call.
   */
  static async callDashboardAPI(
    input: ProjectDashboardInput
  ): Promise<APIResponse<ProjectDashboardOutput>> {
    return GCloudAPIService.projectDashboard(input);
  }

  /**
   * Calls the admin API and returns the result. Requires super admin access.
   *
   * @param input - The input for the admin API call.
   */
  static async callAdminAPI(input: AdminInput): Promise<APIResponse<AdminOutput>> {
    return GCloudAPIService.admin(input);
  }

  /**
   * Calls the workout API and returns the result.
   *
   * @param input - The input for the workout API call.
   */
  static async callWorkoutAPI(
    input: ProjectWorkoutPrimaryInput
  ): Promise<APIResponse<ProjectWorkoutPrimaryOutput>> {
    return GCloudAPIService.projectWorkout(input);
  }

  /**
   * Gets the current base URL for the API.
   */
  static getCurrentAPIUrl(): string {
    return GCloudAPIService.getUrl();
  }

  /**
   * Sets the base URL for the API.
   *
   * @param url - The URL to be set for the API. This should include a trailing slash.
   */
  static setAPIUrl(url: string): void {
    GCloudAPIService.setUrl(url);
  }

  /**
   * Gets the default base URL for the API.
   */
  static getDefaultAPIUrl(): string {
    return GCloudAPIService.defaultUrl;
  }
}
