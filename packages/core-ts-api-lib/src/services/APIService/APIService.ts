import { DOFunctionCallOutput } from '../DOFunctionService/DOFunction.js';
import DOFunctionService from '../DOFunctionService/DOFunctionService.js';
import {
  AuthValidateUserInput,
  AuthValidateUserOutput
} from '../DOFunctionService/functions/authValidateUser.js';
import {
  ProjectDashboardInput,
  ProjectDashboardOutput
} from '../DOFunctionService/functions/projectDashboard.js';

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
  ): Promise<DOFunctionCallOutput<AuthValidateUserOutput>> {
    const result = await DOFunctionService.authValidateUser.call(input);
    return result;
  }

  /**
   * Sets the URL for the dashboard API.
   *
   * @param url - The URL to be set for the dashboard API.
   */
  static setDashboardAPIUrl(url: string) {
    DOFunctionService.projectDashboard.setUrl(url);
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
  ): Promise<DOFunctionCallOutput<ProjectDashboardOutput>> {
    const result = await DOFunctionService.projectDashboard.call(input);
    return result;
  }
}
