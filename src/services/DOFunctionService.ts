/**
 * Output from a Digital Ocean function must always be an object.
 */
export type DOFunctionOutput<TOutput extends object> = {
  /**
   * The body is an object, which means it will automatically be serialized to
   * JSON and the Content-Type header will be set to application/json.
   */
  body: TOutput;
};

/**
 * A service to provide some utility common to multiple Digital Ocean functions.
 */
export default class DOFunctionService {}
