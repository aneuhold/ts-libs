import { EJSON } from 'bson';

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
  data: string;
}

/**
 * Raw output from a Digital Ocean function must always be an object with
 * a body property. The body property must also be an object.
 */
export interface DOFunctionRawOutput {
  /**
   * The body is an object, which means it will automatically be serialized to
   * JSON and the Content-Type header will be set to application/json.
   *
   * Because the output typically depends on bson, the data must be serialized
   * to EJSON using the EJSON.stringify. Then when it is received, it must be
   * parsed using EJSON.parse.
   */
  body: {
    success: boolean;
    errors: string[];
    data: string;
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
   * A generic call method for any digital ocean function.
   */
  async call(input: TInput): Promise<DOFunctionCallOutput<TOutput>> {
    if (!this.url) {
      throw new Error(`${this.functionName} URL is not set`);
    }
    const rawInput: DOFunctionRawInput = {
      data: EJSON.stringify(input, { relaxed: false })
    };
    const result = await fetch(`${this.url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rawInput)
    });
    const json: DOFunctionRawOutput = await result.json();
    console.log(json);
    return {
      success: json.body.success,
      errors: json.body.errors,
      data: EJSON.parse(json.body.data)
    };
  }
}
