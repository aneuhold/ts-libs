import { DateService, ErrorUtils } from '@aneuhold/core-ts-lib';
import type { AdminInput, AdminOutput } from '../../types/Admin.js';
import type { APIResponse } from '../../types/APIResponse.js';
import type {
  AuthDeleteAccountInput,
  AuthDeleteAccountOutput
} from '../../types/AuthDeleteAccount.js';
import type {
  AuthRefreshTokenInput,
  AuthRefreshTokenOutput,
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

  static #onAuthExpired: OnAuthExpiredCallback | null = null;

  static #refreshPromise: Promise<boolean> | null = null;

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
   * Registers a callback that is invoked when the session cannot be recovered
   * on a 401 (no refresh token, refresh failed, or the post-refresh retry is
   * still 401). The stored tokens are cleared before the callback fires, so use
   * this to clear the consumer's own copy of them and prompt re-login.
   *
   * @param callback - The callback invoked when auth has expired.
   */
  static setOnAuthExpired(callback: OnAuthExpiredCallback | null): void {
    this.#onAuthExpired = callback;
  }

  /**
   * Calls the auth validateUser endpoint.
   *
   * @param input - The input for the validateUser endpoint.
   */
  static async authValidateUser(
    input: AuthValidateUserInput
  ): Promise<APIResponse<AuthValidateUserOutput>> {
    return this.#call<AuthValidateUserInput, AuthValidateUserOutput>('auth/validateUser', input);
  }

  /**
   * Calls the auth logout endpoint to delete the current refresh token
   * server-side using the stored refresh token string.
   */
  static async authLogout(): Promise<APIResponse<undefined>> {
    if (!this.#refreshTokenString) {
      return { success: true, errors: [], data: undefined };
    }
    const { decoded } = await this.#fetchAndDecode<AuthRefreshTokenInput, undefined>(
      'auth/logout',
      {
        refreshTokenString: this.#refreshTokenString
      }
    );
    return decoded;
  }

  /**
   * Calls the auth deleteAccount endpoint to permanently delete the
   * currently-authenticated user and every per-user document tied to them.
   */
  static async authDeleteAccount(): Promise<APIResponse<AuthDeleteAccountOutput>> {
    return this.#call<AuthDeleteAccountInput, AuthDeleteAccountOutput>(
      'auth/deleteAccount',
      undefined
    );
  }

  /**
   * Calls the project dashboard endpoint to get, insert, update, or delete dashboard data.
   *
   * @param input - The input for the project dashboard function.
   */
  static async projectDashboard(
    input: ProjectDashboardInput
  ): Promise<APIResponse<ProjectDashboardOutput>> {
    return this.#call<ProjectDashboardInput, ProjectDashboardOutput>('project/dashboard', input);
  }

  /**
   * Calls the admin endpoint. Requires super admin access.
   *
   * @param input - The input for the admin endpoint.
   */
  static async admin(input: AdminInput): Promise<APIResponse<AdminOutput>> {
    return this.#call<AdminInput, AdminOutput>('admin', input);
  }

  /**
   * Calls the project workout endpoint to get, insert, update, or delete workout data.
   *
   * @param input - The input for the project workout function.
   */
  static async projectWorkout(
    input: ProjectWorkoutPrimaryInput
  ): Promise<APIResponse<ProjectWorkoutPrimaryOutput>> {
    return this.#call<ProjectWorkoutPrimaryInput, ProjectWorkoutPrimaryOutput>(
      'project/workout',
      input
    );
  }

  /**
   * Makes a call to the API. On a 401 response, automatically attempts to
   * refresh the access token using the stored refresh token. If refresh
   * succeeds, the original request is retried once. When the session cannot be
   * recovered, the stored tokens are cleared and the {@link #onAuthExpired}
   * callback fires.
   *
   * @param urlPath - The path to the endpoint.
   * @param input - The input to the endpoint.
   */
  static async #call<TInput, TOutput>(
    urlPath: string,
    input: TInput
  ): Promise<APIResponse<TOutput>> {
    let { response, decoded } = await this.#fetchAndDecode<TInput, TOutput>(urlPath, input);

    // On a 401, try once to recover by refreshing the tokens and retrying.
    // #tryRefreshTokens returns false when there is no refresh token to use.
    if (response.status === 401 && (await this.#tryRefreshTokens())) {
      // Fancy destructure into pre-existing variables
      ({ response, decoded } = await this.#fetchAndDecode<TInput, TOutput>(urlPath, input));
    }

    // Still a 401 after any recovery attempt means the session cannot be
    // recovered, so drop the dead tokens and notify the frontend to prompt
    // re-login.
    if (response.status === 401) {
      this.#accessToken = undefined;
      this.#refreshTokenString = undefined;
      this.#onAuthExpired?.();
    }

    return decoded;
  }

  /**
   * Attempts to refresh the access token, sharing one in-flight refresh across
   * concurrent callers. Refresh tokens rotate server-side, so parallel
   * refreshes sent with the same token would invalidate each other and drop the
   * session.
   */
  static async #tryRefreshTokens(): Promise<boolean> {
    // Set the refreshPromise only if it is currently null, otherwise we continue.
    this.#refreshPromise ??= this.#performTokenRefresh();
    try {
      return await this.#refreshPromise;
    } finally {
      // Cleared once settled so the next 401 starts a fresh attempt rather than
      // reusing a stale result.
      this.#refreshPromise = null;
    }
  }

  /**
   * Exchanges the stored refresh token for a new token pair. On success,
   * updates the stored tokens and notifies via the {@link #onTokensRefreshed}
   * callback.
   */
  static async #performTokenRefresh(): Promise<boolean> {
    if (!this.#refreshTokenString) {
      return false;
    }

    const { decoded } = await this.#fetchAndDecode<AuthRefreshTokenInput, AuthRefreshTokenOutput>(
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
  static async #fetchAndDecode<TInput, TOutput>(
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
    const decoded = await this.#decodeResponse<TOutput>(response);
    return { response, decoded };
  }

  /**
   * Decodes a fetch Response into an APIResponse.
   *
   * @param response - The fetch response to decode.
   */
  static async #decodeResponse<TOutput>(response: Response): Promise<APIResponse<TOutput>> {
    try {
      const text = await response.text();
      const parsed: unknown = JSON.parse(text, DateService.dateReviver);
      if (!this.#isAPIResponseShape<TOutput>(parsed)) {
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

  /**
   * Type guard that validates the structural shape of an {@link APIResponse}.
   * The generic `data` payload is trusted (not validated) since its shape is
   * only known at the call site.
   *
   * @param value - The parsed JSON value to inspect.
   */
  static #isAPIResponseShape<TOutput>(value: unknown): value is APIResponse<TOutput> {
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
}
