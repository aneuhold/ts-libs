import { DateService, ErrorUtils } from '@aneuhold/core-ts-lib';
import type { APIResponse } from '../../types/APIResponse.js';
import type {
  AuthValidateUserInput,
  AuthValidateUserOutput
} from '../../types/AuthValidateUser.js';
import type {
  ProjectDashboardInput,
  ProjectDashboardOutput
} from '../../types/ProjectDashboard.js';

/**
 * A service for interacting with the Google Cloud API service for personal projects.
 */
export default class GCloudAPIService {
  /**
   * The base URL of the Google Cloud API. For example, `something.com/api/`. It will include
   * the trailing slash.
   */
  static #baseUrl: string = 'https://gcloud-backend-926119935605.us-west1.run.app/';

  /**
   * Sets the URL of the Google Cloud API.
   *
   * @param url - The URL to set.
   */
  static setUrl(url: string): void {
    this.#baseUrl = url;
  }

  /**
   * Calls the project dashboard endpoint to get, insert, update, or delete dashboard data.
   *
   * @param input - The input for the project dashboard function.
   */
  static async authValidateUser(
    input: AuthValidateUserInput
  ): Promise<APIResponse<AuthValidateUserOutput>> {
    return this.call<AuthValidateUserInput, AuthValidateUserOutput>('auth/validateUser', input);
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
   * Makes a call to the Google Cloud API.
   *
   * @param urlPath - The path to the endpoint.
   * @param input - The input to the endpoint.
   * @throws {Error} Will throw an error if the URL is not set.
   */
  private static async call<TInput extends object, TOutput>(
    urlPath: string,
    input: TInput
  ): Promise<APIResponse<TOutput>> {
    const response = await fetch(this.#baseUrl + urlPath, {
      method: 'POST',
      headers: {
        Connection: 'keep-alive',
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(input)
    });
    const decodedResponse = await this.decodeResponse<TOutput>(response);
    return decodedResponse;
  }

  /**
   * Decodes the response from the Google Cloud API.
   *
   * @param response - The response to decode.
   * @returns The decoded output.
   */
  private static async decodeResponse<TOutput>(response: Response): Promise<APIResponse<TOutput>> {
    try {
      const text = await response.text();
      return JSON.parse(text, DateService.dateReviver) as APIResponse<TOutput>;
    } catch (error) {
      return {
        success: false,
        errors: ['Failed to parse response', ErrorUtils.getErrorString(error)],
        data: {} as TOutput
      };
    }
  }
}
