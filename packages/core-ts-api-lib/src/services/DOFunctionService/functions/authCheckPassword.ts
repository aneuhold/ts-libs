import DOFunction, {
  DOFunctionInput,
  DOFunctionOutput
} from '../DOFunction.js';

/**
 * Input interface for {@link AuthCheckPassword}.
 */
export interface AuthCheckPasswordInput extends DOFunctionInput {
  password: string;
}

/**
 * Output interface for {@link AuthCheckPassword}.
 */
export interface AuthCheckPasswordOutput extends DOFunctionOutput {
  passwordIsCorrect: boolean;
}

/**
 * Class representing the AuthCheckPassword function.
 *
 * This class is a singleton and provides a method to get the instance of the function.
 */
export default class AuthCheckPassword extends DOFunction<
  AuthCheckPasswordInput,
  AuthCheckPasswordOutput
> {
  private static instance: AuthCheckPassword | undefined;

  private constructor() {
    super();
    this.url =
      'https://faas-sfo3-7872a1dd.doserverless.co/api/v1/web/fn-66dd3ef6-c21d-46dc-b7ae-caf2ac8041ec/auth/checkPassword';
  }

  /**
   * Gets the singleton instance of {@link AuthCheckPassword}.
   *
   * @returns The instance of the AuthCheckPassword function.
   */
  static getFunction(): AuthCheckPassword {
    if (!AuthCheckPassword.instance) {
      AuthCheckPassword.instance = new AuthCheckPassword();
    }
    return AuthCheckPassword.instance;
  }
}
