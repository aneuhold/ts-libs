import fetch from 'node-fetch';
import {
  DOFunctionInfo,
  DOFunctionInput,
  DOFunctionOutput,
  DOFunctionRawOutput
} from '../DOFunctionService';

export type DOAuthCheckPasswordInput = DOFunctionInput<{ password: string }>;
export type DOAuthCheckPasswordOutput = DOFunctionOutput<{
  passwordIsCorrect: boolean;
}>;
export type DOAuthCheckPasswordRawOutput =
  DOFunctionRawOutput<DOAuthCheckPasswordOutput>;

const authCheckPasswordInfo: DOFunctionInfo<
  DOAuthCheckPasswordInput,
  DOAuthCheckPasswordOutput
> = {
  url: 'https://faas-sfo3-7872a1dd.doserverless.co/api/v1/web/fn-66dd3ef6-c21d-46dc-b7ae-caf2ac8041ec/auth/checkPassword',
  call: async (input: DOAuthCheckPasswordInput) => {
    const result = await fetch(`${authCheckPasswordInfo.url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input)
    });
    const json = (await result.json()) as DOAuthCheckPasswordOutput;
    return json;
  }
};

export default authCheckPasswordInfo;
