import { BSON } from 'bson';
import { APIResponse } from '../../types/APIResponse.js';
import {
  AuthValidateUserInput,
  AuthValidateUserOutput
} from '../DOFunctionService/functions/authValidateUser.js';
import {
  ProjectDashboardInput,
  ProjectDashboardOutput
} from '../DOFunctionService/functions/projectDashboard.js';

/**
 * A service for interacting with the Google Cloud API service for personal projects.
 */
export default class GCloudAPIService {
  /**
   * The base URL of the Google Cloud API. For example, `something.com/api/`. It will include
   * the trailing slash.
   */
  static #baseUrl?: string;

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
    if (!this.#baseUrl) {
      throw new Error('GCloudAPI URL is not set');
    }

    const response = await fetch(this.#baseUrl + urlPath, {
      method: 'POST',
      headers: {
        Connection: 'keep-alive',
        'Content-Type': 'application/octet-stream',
        Accept: 'application/octet-stream'
      },
      body: Buffer.from(BSON.serialize(input))
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
    const contentType = response.headers.get('Content-Type');
    const isBson = contentType?.includes('application/octet-stream');
    if (isBson) {
      const buffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      return BSON.deserialize(uint8Array) as APIResponse<TOutput>;
    } else {
      // This normally only happens if there is an error
      const result = (await response.json()) as unknown;
      return {
        success: false,
        errors: [JSON.stringify(result, null, 2)],
        data: {} as TOutput
      };
    }
  }
}
