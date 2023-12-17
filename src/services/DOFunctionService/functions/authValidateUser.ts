import { ApiKey, User } from '@aneuhold/core-ts-db-lib';
import {
  DOFunctionInfo,
  DOFunctionInput,
  DOFunctionOutput,
  DOFunctionRawOutput
} from '../DOFunctionService';

export interface AuthValidateUserInput extends DOFunctionInput {
  userName: string;
  password: string;
}
export interface AuthValidateUserOutput extends DOFunctionOutput {
  success: boolean;
  userInfo?: {
    user: User;
    apiKey: ApiKey;
  };
}
export interface AuthValidateUserRawOutput
  extends DOFunctionRawOutput<AuthValidateUserOutput> {
  body: AuthValidateUserOutput;
}

const authValidateUser: DOFunctionInfo<
  AuthValidateUserInput,
  AuthValidateUserOutput
> = {
  url: 'TBD',
  call: async (input: AuthValidateUserInput) => {
    const result = await fetch(`${authValidateUser.url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input)
    });
    const json = (await result.json()) as AuthValidateUserOutput;
    return json;
  }
};

export default authValidateUser;
