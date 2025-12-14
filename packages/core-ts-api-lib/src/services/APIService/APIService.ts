import type { APIResponse } from '../../types/APIResponse.js';
import type {
  AuthValidateUserInput,
  AuthValidateUserOutput
} from '../../types/AuthValidateUser.js';
import type {
  ProjectDashboardInput,
  ProjectDashboardOutput
} from '../../types/ProjectDashboard.js';
import GCloudAPIService from '../GCloudAPIService/GCloudAPIService.js';

/**
 * A service for making calls to the backend API for personal projects. This is
 * abstracted so that the backend implementation can change over time.
 */
export default class APIService {
  /**
   * Validates the provided username and password against the database and
   * returns the user's information if successful.
   *
   * @param input - The input containing username and password.
   * @returns A promise that resolves to the user's information if validation is successful.
   */
  static async validateUser(
    input: AuthValidateUserInput
  ): Promise<APIResponse<AuthValidateUserOutput>> {
    return await GCloudAPIService.authValidateUser(input);
  }

  /**
   * Calls the dashboard API and returns the result. This will fail if the
   * dashboard API URL has not been set. See {@link setDashboardAPIUrl}.
   *
   * @param input - The input for the dashboard API call.
   * @returns A promise that resolves to the result of the dashboard API call.
   */
  static async callDashboardAPI(
    input: ProjectDashboardInput
  ): Promise<APIResponse<ProjectDashboardOutput>> {
    return GCloudAPIService.projectDashboard(input);
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
