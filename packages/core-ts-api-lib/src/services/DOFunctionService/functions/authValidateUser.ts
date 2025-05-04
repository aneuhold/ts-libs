import { ApiKey, User } from '@aneuhold/core-ts-db-lib';
import { DashboardConfig } from '../../../types/DashboardConfig.js';
import DOFunction, {
  DOFunctionInput,
  DOFunctionOutput
} from '../DOFunction.js';

/**
 * Interface representing the input to the {@link AuthValidateUser} function.
 */
export interface AuthValidateUserInput extends DOFunctionInput {
  /**
   * The username of the user to be validated.
   */
  userName: string;
  /**
   * The password of the user to be validated.
   */
  password: string;
}

/**
 * Interface representing the output of the {@link AuthValidateUser} function.
 */
export interface AuthValidateUserOutput extends DOFunctionOutput {
  /**
   * Information about the authenticated user.
   */
  userInfo?: {
    user: User;
    apiKey: ApiKey;
  };
  /**
   * Basic configuration for the projects that the user has access to.
   */
  config?: {
    dashboard?: DashboardConfig;
  };
}

/**
 * Class representing the {@link AuthValidateUser} function.
 * This class is a singleton and extends {@link DOFunction}.
 * It is used to validate user authentication.
 */
export default class AuthValidateUser extends DOFunction<
  AuthValidateUserInput,
  AuthValidateUserOutput
> {
  private static instance: AuthValidateUser | undefined;

  /**
   * Private constructor to prevent direct instantiation.
   * Initializes the URL for the validate user function.
   */
  private constructor() {
    super();
    this.url =
      'https://faas-sfo3-7872a1dd.doserverless.co/api/v1/web/fn-66dd3ef6-c21d-46dc-b7ae-caf2ac8041ec/auth/validateUser';
  }

  /**
   * Retrieves the singleton instance of {@link AuthValidateUser}.
   * If the instance does not exist, it creates a new one.
   *
   * @returns The singleton instance of {@link AuthValidateUser}.
   */
  static getFunction(): AuthValidateUser {
    if (!AuthValidateUser.instance) {
      AuthValidateUser.instance = new AuthValidateUser();
    }
    return AuthValidateUser.instance;
  }
}
