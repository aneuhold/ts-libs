import type { AdminInput, AdminOutput } from '../../types/Admin.js';
import type { APIResponse } from '../../types/APIResponse.js';
import type { AuthDeleteAccountOutput } from '../../types/AuthDeleteAccount.js';
import type {
  OnAuthExpiredCallback,
  OnTokensRefreshedCallback
} from '../../types/AuthRefreshToken.js';
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
import GCloudAPIService from '../GCloudAPIService/GCloudAPI.service.js';
import type { IAPIBackend } from './IAPIBackend.js';

/**
 * A service for making calls to the backend API for personal projects. Every
 * call is delegated to the installed {@link IAPIBackend}, which defaults to
 * {@link GCloudAPIService}.
 */
export default class APIService {
  static #backend: IAPIBackend = GCloudAPIService;

  /**
   * Replaces the backend that every call is delegated to.
   *
   * @param backend - The backend to delegate to.
   */
  static setBackend(backend: IAPIBackend): void {
    APIService.#backend = backend;
  }

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
    return APIService.#backend.authValidateUser(input);
  }

  /**
   * Logs out the current session by deleting the stored refresh token
   * server-side.
   */
  static async logout(): Promise<APIResponse<undefined>> {
    return APIService.#backend.authLogout();
  }

  /**
   * Permanently deletes the currently-authenticated user along with every
   * per-user document tied to them.
   */
  static async deleteAccount(): Promise<APIResponse<AuthDeleteAccountOutput>> {
    return APIService.#backend.authDeleteAccount();
  }

  /**
   * Sets the JWT access token to attach to all API requests.
   *
   * @param token - The access token.
   */
  static setAccessToken(token: string): void {
    APIService.#backend.setAccessToken(token);
  }

  /**
   * Sets the refresh token string used for automatic token refresh on 401.
   *
   * @param token - The refresh token string.
   */
  static setRefreshTokenString(token: string): void {
    APIService.#backend.setRefreshTokenString(token);
  }

  /**
   * Registers a callback that is invoked after tokens are automatically
   * refreshed (e.g. to persist new tokens to localStorage).
   *
   * @param callback - The callback receiving the new accessToken and refreshTokenString.
   */
  static setOnTokensRefreshed(callback: OnTokensRefreshedCallback | null): void {
    APIService.#backend.setOnTokensRefreshed(callback);
  }

  /**
   * Registers a callback that is invoked when the session cannot be recovered
   * on a 401 (no refresh token, refresh failed, or the retry is still 401). The
   * stored tokens are cleared before the callback fires, so use this to clear
   * the consumer's own copy of them and prompt the user to log in again.
   *
   * @param callback - The callback invoked when auth has expired.
   */
  static setOnAuthExpired(callback: OnAuthExpiredCallback | null): void {
    APIService.#backend.setOnAuthExpired(callback);
  }

  /**
   * Calls the dashboard API and returns the result.
   *
   * @param input - The input for the dashboard API call.
   */
  static async callDashboardAPI(
    input: ProjectDashboardInput
  ): Promise<APIResponse<ProjectDashboardOutput>> {
    return APIService.#backend.projectDashboard(input);
  }

  /**
   * Calls the admin API and returns the result. Requires super admin access.
   *
   * @param input - The input for the admin API call.
   */
  static async callAdminAPI(input: AdminInput): Promise<APIResponse<AdminOutput>> {
    return APIService.#backend.admin(input);
  }

  /**
   * Calls the workout API and returns the result.
   *
   * @param input - The input for the workout API call.
   */
  static async callWorkoutAPI(
    input: ProjectWorkoutPrimaryInput
  ): Promise<APIResponse<ProjectWorkoutPrimaryOutput>> {
    return APIService.#backend.projectWorkout(input);
  }

  /**
   * Gets the current base URL for the API.
   */
  static getCurrentAPIUrl(): string {
    return APIService.#backend.getUrl();
  }

  /**
   * Sets the base URL for the API.
   *
   * @param url - The URL to be set for the API. This should include a trailing slash.
   */
  static setAPIUrl(url: string): void {
    APIService.#backend.setUrl(url);
  }

  /**
   * Gets the default base URL for the API.
   */
  static getDefaultAPIUrl(): string {
    return APIService.#backend.defaultUrl;
  }
}
