import {
  DOFunctionInfo,
  DOFunctionInput,
  DOFunctionOutput,
  DOFunctionRawOutput
} from '../DOFunctionService';

export interface AuthCheckPasswordInput extends DOFunctionInput {
  password: string;
}
export interface AuthCheckPasswordOutput extends DOFunctionOutput {
  passwordIsCorrect: boolean;
}
export interface AuthCheckPasswordRawOutput
  extends DOFunctionRawOutput<AuthCheckPasswordOutput> {
  body: AuthCheckPasswordOutput;
}

const authCheckPassword: DOFunctionInfo<
  AuthCheckPasswordInput,
  AuthCheckPasswordOutput
> = {
  url: 'https://faas-sfo3-7872a1dd.doserverless.co/api/v1/web/fn-66dd3ef6-c21d-46dc-b7ae-caf2ac8041ec/auth/checkPassword',
  call: async (input: AuthCheckPasswordInput) => {
    const result = await fetch(`${authCheckPassword.url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input)
    });
    const json = (await result.json()) as AuthCheckPasswordOutput;
    return json;
  }
};

export default authCheckPassword;
