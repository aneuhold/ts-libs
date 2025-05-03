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
 * Raw input to a Digital Ocean function. This is with the expectation that
 * `web: raw` is set in the `project.yml` file.
 */
export interface DOFunctionRawInput {
  http: {
    /**
     * The body to be parsed or deserialized.
     */
    body: string;
    headers: {
      accept?: string;
      'accept-encoding'?: string;
      /**
       * This is important.
       */
      'content-type'?: string;
      host?: string;
      'user-agent'?: string;
      'x-forwarded-for'?: string;
      'x-forwarded-proto'?: string;
      'x-request-id'?: string;
    };
    /**
     * This needs to be used to determine if the body is base64 encoded.
     */
    isBase64Encoded: boolean;
    method?: string;
    path?: string;
    queryString?: string;
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
  statusCode: number;
  headers: {
    /**
     * This is different than what gets passed in. This is on purpose. DO
     * functions changes the header name when being passed in, but not when
     * being passed out.
     */
    'Content-Type': string;
  };
}

/**
 * A generic interface representing the output of a Digital Ocean function call.
 */
export interface DOFunctionCallOutput<TOutput extends DOFunctionOutput> {
  success: boolean;
  errors: string[];
  data: TOutput;
}

/**
 * Type guard to check if an input object conforms to the DOFunctionRawInput structure.
 *
 * @param input - The input object to check.
 * @returns True if the input is DOFunctionRawInput, false otherwise.
 */
export function isDOFunctionRawInput(
  input: unknown
): input is DOFunctionRawInput {
  return (
    !!input &&
    typeof input === 'object' &&
    'http' in input &&
    typeof (input as DOFunctionRawInput).http === 'object' &&
    'body' in (input as DOFunctionRawInput).http && // Check for essential http properties
    'isBase64Encoded' in (input as DOFunctionRawInput).http
  );
}

/**
 * An abstract class representing a Digital Ocean Function.
 *
 * @template TInput - The type of the input to the function, extending {@link DOFunctionInput}.
 * @template TOutput - The type of the output from the function, extending {@link DOFunctionOutput}.
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

  /**
   * Sets the URL of the Digital Ocean function.
   *
   * @param url - The URL to set.
   */
  setUrl(url: string) {
    this.url = url;
  }

  /**
   * A generic call method for any Digital Ocean Function from the client.
   * This gets pretty crazy with the serialization logic. It has been tested
   * heavily.
   *
   * @param input - The input to the function.
   * @returns A promise that resolves to the output of the function call, wrapped in {@link DOFunctionCallOutput}.
   * @throws Will throw an error if the URL is not set.
   */
  async call(input: TInput): Promise<DOFunctionCallOutput<TOutput>> {
    if (!this.url) {
      throw new Error(`${this.functionName} URL is not set`);
    }
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        Connection: 'keep-alive',
        'Content-Type': 'application/octet-stream',
        Accept: 'application/octet-stream'
      },
      body: BSON.serialize(input)
    });
    return await this.decodeResponse(response);
  }

  /**
   * Decodes the response from the Digital Ocean function.
   *
   * @param response - The response to decode.
   * @returns The decoded output.
   */
  private async decodeResponse(
    response: Response
  ): Promise<DOFunctionCallOutput<TOutput>> {
    const isBson =
      response.headers.get('Content-Type') === 'application/octet-stream';
    if (isBson) {
      const buffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      return BSON.deserialize(uint8Array) as DOFunctionCallOutput<TOutput>;
    } else {
      // This normally only happens if there is an error
      const result = (await response.json()) as unknown;
      return {
        success: false,
        errors: [JSON.stringify(result, null, 2)],
        data: {} as TOutput
      };
    }
  }
}
