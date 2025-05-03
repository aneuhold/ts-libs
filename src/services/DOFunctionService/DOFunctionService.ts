import { DR } from '@aneuhold/core-ts-lib';
import { BSON } from 'bson';
import {
  DOFunctionCallOutput,
  DOFunctionInput,
  DOFunctionOutput,
  DOFunctionRawInput,
  DOFunctionRawOutput
} from './DOFunction.js';
import AuthCheckPassword from './functions/authCheckPassword.js';
import AuthValidateUser from './functions/authValidateUser.js';
import ProjectDashboard from './functions/projectDashboard.js';

/**
 * A service to provide some utility related to Digital Ocean functions.
 */
export default class DOFunctionService {
  /**
   * {@link AuthCheckPassword} function instance.
   */
  static authCheckPassword: AuthCheckPassword = AuthCheckPassword.getFunction();

  /**
   * {@link AuthValidateUser} function instance.
   */
  static authValidateUser: AuthValidateUser = AuthValidateUser.getFunction();

  /**
   * {@link ProjectDashboard} function instance.
   */
  static projectDashboard: ProjectDashboard = ProjectDashboard.getFunction();

  /**
   * A generic method to handle any API request on the backend. This has
   * no use on the frontend.
   *
   * This will take care of returning the error if the handler throws, and
   * managing tracing spans via the registered ITracer.
   * Ideally the handler should not throw though unless something really
   * unexpected happened.
   *
   * @param functionName - The name to use for the root tracing span.
   * @param rawInput - The raw input for the function.
   * @param handler - The handler function to process the input.
   * @returns The raw output of the function call.
   */
  static async handleApiRequest<
    TInput extends DOFunctionInput,
    TOutput extends DOFunctionOutput
  >(
    functionName: string,
    rawInput: DOFunctionRawInput,
    handler: (input: TInput) => Promise<DOFunctionCallOutput<TOutput>>
  ): Promise<DOFunctionRawOutput> {
    return DR.tracer.startSpan(functionName, async (span) => {
      // Default raw output
      const rawOutput: DOFunctionRawOutput = {
        body: '',
        statusCode: 200,
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      };
      // Default output
      const defaultOutput: DOFunctionCallOutput<TOutput> = {
        success: false,
        errors: [],
        data: {} as TOutput
      };
      try {
        // Deserialize the input
        const input: TInput = this.deserializeInput(rawInput);
        // Call the handler
        const output = await handler(input);
        // Serialize the output
        rawOutput.body = this.serializeOutput(output);
        if (!output.success) {
          rawOutput.statusCode = 400; // Bad Request if handler indicates failure
          span?.setStatus({ code: 2, message: 'handler_error' }); // Indicate error in span
        } else {
          span?.setStatus({ code: 1, message: 'ok' }); // OK
        }
      } catch (e) {
        // Capture unexpected errors
        DR.tracer.captureException(e);
        span?.setStatus({ code: 2, message: 'internal_error' }); // Internal Server Error

        // Serialize as JSON if something fails to simplify in case the error
        // happened in the normal serialization.
        const error = e as Error;
        defaultOutput.errors.push(JSON.stringify(error, null, 2));
        rawOutput.body = JSON.stringify(defaultOutput);
        rawOutput.headers['Content-Type'] = 'application/json';
        rawOutput.statusCode = 500;
      } finally {
        // Ensure traces are flushed in serverless environments
        if (DR.tracer.isEnabled()) {
          await DR.tracer.flush(2000);
        }
      }
      return rawOutput;
    });
  }

  /**
   * Deserializes the raw input into a typed input object.
   *
   * @param rawInput - The raw input to deserialize.
   * @returns The deserialized input object.
   */
  private static deserializeInput<TInput extends DOFunctionInput>(
    rawInput: DOFunctionRawInput
  ): TInput {
    const { http } = rawInput;
    const { body, isBase64Encoded, headers } = http;

    let decodedBody: Buffer;
    if (isBase64Encoded) {
      decodedBody = Buffer.from(body, 'base64');
    } else {
      decodedBody = Buffer.from(body, 'utf8');
    }

    // Determine if the incoming content type is BSON
    const isBson = headers['content-type'] === 'application/octet-stream';
    let requestData: TInput;
    if (isBson) {
      // Deserialize BSON data
      requestData = BSON.deserialize(decodedBody) as TInput;
    } else {
      // Parse JSON data
      requestData = JSON.parse(decodedBody.toString('utf8')) as TInput;
    }

    return requestData;
  }

  /**
   * Serializes the output object into a base64 string. This could be updated
   * to support other serialization methods in the future.
   *
   * @param output - The output object to serialize.
   * @returns The serialized output as a base64 string.
   */
  private static serializeOutput<TOutput extends DOFunctionOutput>(
    output: DOFunctionCallOutput<TOutput>
  ): string {
    const bsonBuffer = BSON.serialize(output);
    return Buffer.from(bsonBuffer).toString('base64');
  }
}
