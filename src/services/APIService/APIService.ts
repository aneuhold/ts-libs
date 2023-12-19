import DOFunctionService from '../DOFunctionService/DOFunctionService';
import { AuthValidateUserInput } from '../DOFunctionService/functions/authValidateUser';

/**
 * A service for making calls to the backend API for personal projects. This is
 * abstracted so that the backend implementation can change over time.
 */
export default class APIService {
  /**
   * Validates the provided username and password against the database and
   * returns the user's information if successful.
   */
  static async validateUser(input: AuthValidateUserInput) {
    const result = await DOFunctionService.authValidateUser.call(input);
    return result;
  }
}
