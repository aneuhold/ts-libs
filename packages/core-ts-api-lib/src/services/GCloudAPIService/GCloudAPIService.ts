import { DateService, ErrorUtils } from '@aneuhold/core-ts-lib';
import type { AdminInput, AdminOutput } from '../../types/Admin.js';
import type { APIResponse } from '../../types/APIResponse.js';
import type {
  AuthRefreshTokenInput,
  AuthRefreshTokenOutput
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

/**
 * Callback invoked after tokens are successfully refreshed. The frontend
 * should use this to persist the new tokens (e.g. to localStorage).
 */
type OnTokensRefreshedCallback = (accessToken: string, refreshTokenString: string) => void;

/**
 * A service for interacting with the Google Cloud API service for personal projects.
 */
export default class GCloudAPIService {
  static readonly defaultUrl: string = 'https://api.antonneuhold.com/';

  /**
   * The base URL of the Google Cloud API. For example, `something.com/api/`. It will include
   * the trailing slash.
   */
  static #baseUrl: string = this.defaultUrl;

  static #accessToken: string | undefined;

  static #refreshTokenString: string | undefined;

  static #onTokensRefreshed: OnTokensRefreshedCallback | null = null;

  /**
   * Gets the current URL of the Google Cloud API.
   *
   * @returns the current URL of the Google Cloud API.
   */
  static getUrl(): string {
    return this.#baseUrl;
  }

  /**
   * Sets the URL of the Google Cloud API.
   *
   * @param url - The URL to set.
   */
  static setUrl(url: string): void {
    this.#baseUrl = url;
  }

  /**
   * Sets the JWT access token to attach to all API requests.
   *
   * @param token - The access token.
   */
  static setAccessToken(token: string): void {
    this.#accessToken = token;
  }

  /**
   * Sets the refresh token string used for automatic token refresh on 401
   * responses.
   *
   * @param token - The refresh token string.
   */
  static setRefreshTokenString(token: string): void {
    this.#refreshTokenString = token;
  }

  /**
   * Registers a callback that is invoked after tokens are automatically
   * refreshed. Use this to persist the new tokens to storage (e.g.
   * localStorage).
   *
   * @param callback - The callback receiving the new accessToken and refreshTokenString.
   */
  static setOnTokensRefreshed(callback: OnTokensRefreshedCallback | null): void {
    this.#onTokensRefreshed = callback;
  }

  /**
   * Calls the auth validateUser endpoint.
   *
   * @param input - The input for the validateUser endpoint.
   */
  static async authValidateUser(
    input: AuthValidateUserInput
  ): Promise<APIResponse<AuthValidateUserOutput>> {
    return this.call<AuthValidateUserInput, AuthValidateUserOutput>('auth/validateUser', input);
  }

  /**
   * Calls the auth logout endpoint to delete the current refresh token
   * server-side using the stored refresh token string.
   */
  static async authLogout(): Promise<APIResponse<undefined>> {
    if (!this.#refreshTokenString) {
      return { success: true, errors: [], data: undefined };
    }
    const { decoded } = await this.fetchAndDecode<AuthRefreshTokenInput, undefined>('auth/logout', {
      refreshTokenString: this.#refreshTokenString
    });
    return decoded;
  }

  /**
   * Calls the project dashboard endpoint to get, insert, update, or delete dashboard data.
   *
   * @param input - The input for the project dashboard function.
   */
  static async projectDashboard(
    input: ProjectDashboardInput
  ): Promise<APIResponse<ProjectDashboardOutput>> {
    return this.call<ProjectDashboardInput, ProjectDashboardOutput>('project/dashboard', input);
  }

  /**
   * Calls the admin endpoint. Requires super admin access.
   *
   * @param input - The input for the admin endpoint.
   */
  static async admin(input: AdminInput): Promise<APIResponse<AdminOutput>> {
    return this.call<AdminInput, AdminOutput>('admin', input);
  }

  /**
   * Calls the project workout endpoint to get, insert, update, or delete workout data.
   *
   * @param input - The input for the project workout function.
   */
  static async projectWorkout(
    input: ProjectWorkoutPrimaryInput
  ): Promise<APIResponse<ProjectWorkoutPrimaryOutput>> {
    return this.call<ProjectWorkoutPrimaryInput, ProjectWorkoutPrimaryOutput>(
      'project/workout',
      input
    );
  }

  /**
   * Makes a call to the API. On a 401 response, automatically attempts to
   * refresh the access token using the stored refresh token. If refresh
   * succeeds, the original request is retried once.
   *
   * @param urlPath - The path to the endpoint.
   * @param input - The input to the endpoint.
   */
  private static async call<TInput, TOutput>(
    urlPath: string,
    input: TInput
  ): Promise<APIResponse<TOutput>> {
    const { response, decoded } = await this.fetchAndDecode<TInput, TOutput>(urlPath, input);

    if (response.status === 401 && this.#refreshTokenString) {
      const refreshed = await this.tryRefreshTokens();
      if (refreshed) {
        const retry = await this.fetchAndDecode<TInput, TOutput>(urlPath, input);
        return retry.decoded;
      }
    }

    return decoded;
  }

  /**
   * Attempts to refresh the access token using the stored refresh token.
   * On success, updates the stored tokens and notifies via the
   * {@link #onTokensRefreshed} callback.
   */
  private static async tryRefreshTokens(): Promise<boolean> {
    if (!this.#refreshTokenString) {
      return false;
    }

    const { decoded } = await this.fetchAndDecode<AuthRefreshTokenInput, AuthRefreshTokenOutput>(
      'auth/refresh',
      { refreshTokenString: this.#refreshTokenString }
    );

    if (!decoded.success) {
      return false;
    }

    const { accessToken, refreshTokenString } = decoded.data;
    this.#accessToken = accessToken;
    this.#refreshTokenString = refreshTokenString;

    if (this.#onTokensRefreshed) {
      this.#onTokensRefreshed(accessToken, refreshTokenString);
    }

    return true;
  }

  /**
   * Performs a POST request and decodes the JSON response.
   *
   * @param urlPath - The path to the endpoint.
   * @param input - The input to the endpoint.
   */
  private static async fetchAndDecode<TInput, TOutput>(
    urlPath: string,
    input: TInput
  ): Promise<{ response: Response; decoded: APIResponse<TOutput> }> {
    const headers = new Headers({
      Connection: 'keep-alive',
      'Content-Type': 'application/json',
      Accept: 'application/json'
    });

    if (this.#accessToken) {
      headers.set('Authorization', `Bearer ${this.#accessToken}`);
    }

    const response = await fetch(this.#baseUrl + urlPath, {
      method: 'POST',
      headers,
      body: JSON.stringify(input)
    });
    const decoded = await this.decodeResponse<TOutput>(response);
    return { response, decoded };
  }

  /**
   * Decodes a fetch Response into an APIResponse.
   *
   * @param response - The fetch response to decode.
   */
  private static async decodeResponse<TOutput>(response: Response): Promise<APIResponse<TOutput>> {
    try {
      const text = await response.text();
      const parsed: unknown = JSON.parse(text, DateService.dateReviver);
      if (!isAPIResponseShape<TOutput>(parsed)) {
        return {
          success: false,
          errors: ['Response did not match the expected APIResponse shape'],
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          data: {} as TOutput
        };
      }
      return parsed;
    } catch (error) {
      return {
        success: false,
        errors: ['Failed to parse response', ErrorUtils.getErrorString(error)],
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        data: {} as TOutput
      };
    }
  }
}

/**
 * Type guard that validates the structural shape of an {@link APIResponse}.
 * The generic `data` payload is trusted (not validated) since its shape is
 * only known at the call site.
 *
 * @param value - The parsed JSON value to inspect.
 */
function isAPIResponseShape<TOutput>(value: unknown): value is APIResponse<TOutput> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('success' in value) || typeof value.success !== 'boolean') {
    return false;
  }
  if (!('errors' in value) || !Array.isArray(value.errors)) {
    return false;
  }
  if (!value.errors.every((err) => typeof err === 'string')) {
    return false;
  }
  return 'data' in value;
}
