import { BSON } from 'bson';

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
 * Raw input to a Digital Ocean function will always have a data property
 * which is a string. This string must be parsed using EJSON.parse.
 */
export interface DOFunctionRawInput {
  /**
   * There are many other properties in the `http` object, but only the body
   * property is used.
   */
  http: {
    /**
     * The body property needs to be parsed with atob, then put through some
     * other processing.
     */
    body: string;
  };
}

/**
 * Raw output from a Digital Ocean function must always be an object with
 * a body property. The body property must be a string that is base64 encoded
 * or an object. With how this project is set up, it will always be base64
 * encoded to support BSON types.
 */
export interface DOFunctionRawOutput {
  /**
   * The body is a base64 encoded string.
   */
  body: string;
  headers: {
    'Content-Type': 'application/octet-stream';
  };
}

export interface DOFunctionCallOutput<TOutput extends DOFunctionOutput> {
  success: boolean;
  errors: string[];
  data: TOutput;
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
   * A generic call method for any Digital Ocean Function from the client.
   * This gets pretty crazy with the serialization logic. It has been tested
   * heavily.
   */
  async call(input: TInput): Promise<DOFunctionCallOutput<TOutput>> {
    if (!this.url) {
      throw new Error(`${this.functionName} URL is not set`);
    }
    const result = await fetch(`${this.url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      // It isn't clear why this works by itself. It comes in to the function
      // as a base64 string.
      body: BSON.serialize(input)
    });
    return this.decodeArrayBuffer(await result.arrayBuffer());
  }

  private decodeArrayBuffer(
    buffer: ArrayBuffer
  ): DOFunctionCallOutput<TOutput> {
    const bytes = new Uint8Array(buffer);
    return BSON.deserialize(bytes) as DOFunctionCallOutput<TOutput>;
  }
}
