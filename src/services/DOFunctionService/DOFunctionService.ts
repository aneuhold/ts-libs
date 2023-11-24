import authCheckPasswordInfo from './functionsInfo/authCheckPassword';

/**
 * Raw output from a Digital Ocean function must always be an object with
 * a body property. The body property must also be an object.
 */
export type DOFunctionRawOutput<TOutput extends object> = {
  /**
   * The body is an object, which means it will automatically be serialized to
   * JSON and the Content-Type header will be set to application/json.
   */
  body: DOFunctionOutput<TOutput>;
};

/**
 * The output from a Digital Ocean function must always be an object. This
 * is the data that actually matters and doesn't require parsing the `body`
 * property.
 */
export type DOFunctionOutput<TOutput extends object> = TOutput;

/**
 * The input to a Digital Ocean function must always be an object.
 */
export type DOFunctionInput<TInput extends object> = TInput;

/**
 * Information about a Digital Ocean function.
 */
export type DOFunctionInfo<TInput extends object, TOutput extends object> = {
  url: string;
  call: (args: DOFunctionInput<TInput>) => Promise<DOFunctionOutput<TOutput>>;
};

const doFunctionsInfo = {
  authCheckPassword: authCheckPasswordInfo
};

export type DOFunction = keyof typeof doFunctionsInfo;

/**
 * A service to provide some utility realted to Digital Ocean functions.
 */
export default class DOFunctionService {
  static async call(
    functionName: DOFunction,
    args: (typeof doFunctionsInfo)[DOFunction]['call']['arguments'][0]
  ) {
    const info = doFunctionsInfo[functionName];
    return info.call(args);
  }
}
