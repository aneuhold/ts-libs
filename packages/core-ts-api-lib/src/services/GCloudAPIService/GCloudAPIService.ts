import { APIResponse } from '../../types/APIResponse.js';

/**
 * A service for interacting with the Google Cloud API service for personal projects.
 */
export default class GCloudAPIService {
  /**
   * The base URL of the Google Cloud API. For example, `something.com/api/`. It will include
   * the trailing slash.
   */
  #baseUrl?: string;

  /**
   * Sets the URL of the Google Cloud API.
   *
   * @param url - The URL to set.
   */
  setUrl(url: string): void {
    this.#baseUrl = url;
  }

  /**
   * Makes a call to the Google Cloud API.
   *
   * @param urlPath
   * @param input - The input to the endpoint.
   * @returns A promise that resolves to the output of the function call, wrapped in {@link APIResponse}.
   * @throws Will throw an error if the URL is not set.
   */
  private async call<TInput, TOutput>(
    urlPath: string,
    input: TInput
  ): Promise<APIResponse<TOutput>> {
    if (!this.#baseUrl) {
      throw new Error('GCloudAPI URL is not set');
    }

    const response = await fetch(this.#baseUrl + urlPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      return {
        success: false,
        errors: [`HTTP ${response.status}: ${response.statusText}`],
        data: {} as TOutput
      };
    }

    try {
      const result = (await response.json()) as APIResponse<TOutput>;
      return result;
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to parse response: ${String(error)}`],
        data: {} as TOutput
      };
    }
  }
}
