import DOFunction, { DOFunctionInput, DOFunctionOutput } from '../DOFunction';

export interface AuthCheckPasswordInput extends DOFunctionInput {
  password: string;
}
export interface AuthCheckPasswordOutput extends DOFunctionOutput {
  passwordIsCorrect: boolean;
}

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

  static getFunction() {
    if (!this.instance) {
      AuthCheckPassword.instance = new AuthCheckPassword();
    }
    return AuthCheckPassword.instance;
  }
}
