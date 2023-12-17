import authCheckPassword from './functions/authCheckPassword';
import authValidateUser from './functions/authValidateUser';

/**
 * The input to a Digital Ocean function must always be an object.
 */
export type DOFunctionInput = object;

/**
 * The output from a Digital Ocean function must always be an object. This
 * is the data that actually matters and doesn't require parsing the `body`
 * property.
 */
export type DOFunctionOutput = object;

/**
 * Raw output from a Digital Ocean function must always be an object with
 * a body property. The body property must also be an object.
 */
export interface DOFunctionRawOutput<TOutput extends DOFunctionOutput> {
  /**
   * The body is an object, which means it will automatically be serialized to
   * JSON and the Content-Type header will be set to application/json.
   */
  body: TOutput;
}

/**
 * Information about a Digital Ocean function.
 */
export type DOFunctionInfo<
  TInput extends DOFunctionInput,
  TOutput extends DOFunctionOutput
> = {
  url: string;
  call: (args: TInput) => Promise<TOutput>;
};

/**
 * A service to provide some utility related to Digital Ocean functions.
 */
export default class DOFunctionService {
  static auchCheckPassword = authCheckPassword;

  static authValidateUser = authValidateUser;
}
