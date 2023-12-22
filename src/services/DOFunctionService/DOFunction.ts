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
 * An abstract class that can be extended to define a Digital Ocean
 * function.
 */
export default abstract class DOFunction<
  TInput extends DOFunctionInput,
  TOutput extends DOFunctionOutput
> {
  /**
   * The URL of the digital ocean function.
   */
  protected url?: string;

  protected functionName: string;

  protected constructor() {
    this.functionName = this.constructor.name;
  }

  setUrl(url: string) {
    this.url = url;
  }

  /**
   * A generic call method for any digital ocean function.
   */
  async call(input: TInput): Promise<TOutput> {
    if (!this.url) {
      throw new Error(`${this.functionName} URL is not set`);
    }
    const result = await fetch(`${this.url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input)
    });
    const json = (await result.json()) as DOFunctionRawOutput<TOutput>;
    return json.body;
  }
}
