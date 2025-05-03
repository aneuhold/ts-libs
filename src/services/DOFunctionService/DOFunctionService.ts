import { DR } from '@aneuhold/core-ts-lib';
import { BSON } from 'bson';
import {
  DOFunctionCallOutput,
  DOFunctionInput,
  DOFunctionOutput,
  DOFunctionRawInput,
  DOFunctionRawOutput,
  isDOFunctionRawInput
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
   * @param rawInputFromDO - The raw input for the function.
   * @param handler - The handler function to process the input.
   * @returns The raw output of the function call.
   */
  static async handleApiRequest<
    TInput extends DOFunctionInput,
    TOutput extends DOFunctionOutput
  >(
    functionName: string,
    rawInputFromDO: DOFunctionRawInput | TInput,
    handler: (input: TInput) => Promise<DOFunctionCallOutput<TOutput>>
  ): Promise<DOFunctionRawOutput> {
    DR.logger.info(
      `[DOFunctionService] handleApiRequest called for "${functionName}".`
    ); // Log entry
    DR.logger.info(
      `[DOFunctionService] Calling DR.tracer.startSpan for "${functionName}"...`
    ); // Log before startSpan
    return DR.tracer.startSpan(functionName, async (span) => {
      DR.logger.info(
        `[DOFunctionService] Tracer span callback started for "${functionName}".`
      ); // Log span callback start
      const rawOutput: DOFunctionRawOutput = {
        body: '',
        statusCode: 200,
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      };
      const defaultOutput: DOFunctionCallOutput<TOutput> = {
        success: false,
        errors: [],
        data: {} as TOutput
      };

      try {
        DR.logger.info(
          `[DOFunctionService] Deserializing input for "${functionName}"...`
        ); // Log before deserialize
        const input: TInput = this.deserializeInput(rawInputFromDO);
        DR.logger.info(
          `[DOFunctionService] Calling handler function for "${functionName}"...`
        ); // Log before handler
        const output = await handler(input);
        DR.logger.info(
          `[DOFunctionService] Handler function finished for "${functionName}".`
        ); // Log after handler
        DR.logger.info(
          `[DOFunctionService] Serializing output for "${functionName}"...`
        ); // Log before serialize
        rawOutput.body = this.serializeOutput(output);

        if (!output.success) {
          DR.logger.failure(
            `[DOFunctionService] Handler reported failure for "${functionName}". Setting status code 400.`
          ); // Log handler failure
          rawOutput.statusCode = 400;
          span?.setStatus({ code: 2, message: 'handler_error' });
        } else {
          DR.logger.success(
            `[DOFunctionService] Handler reported success for "${functionName}". Setting status code 200.`
          ); // Log handler success
          span?.setStatus({ code: 1, message: 'ok' });
        }
      } catch (e) {
        DR.logger.error(
          `[DOFunctionService] Error caught in handleApiRequest for "${functionName}": ${String(e)}`
        ); // Log error
        DR.tracer.captureException(e);
        span?.setStatus({ code: 2, message: 'internal_error' });

        const error = e as Error;
        defaultOutput.errors.push(JSON.stringify(error, null, 2));
        rawOutput.body = JSON.stringify(defaultOutput);
        rawOutput.headers['Content-Type'] = 'application/json';
        rawOutput.statusCode = 500;
      }
      DR.logger.info(
        `[DOFunctionService] Tracer span callback finished for "${functionName}". Returning rawOutput.`
      ); // Log span callback end
      return rawOutput;
    });
  }

  /**
   * Deserializes the raw input into a typed input object using type guards.
   * Handles raw HTTP input, the DO UI wrapper, or already deserialized input.
   *
   * @param inputFromDO - The raw input received from the DO environment.
   * @returns The deserialized input object of type TInput.
   */
  private static deserializeInput<TInput extends DOFunctionInput>(
    inputFromDO: DOFunctionRawInput | TInput
  ): TInput {
    DR.logger.info(
      `[DOFunctionService] deserializeInput received: ${JSON.stringify(inputFromDO)}`
    );

    // 1. Check if it's the standard DOFunctionRawInput (from web: raw)
    if (isDOFunctionRawInput(inputFromDO)) {
      DR.logger.info(
        '[DOFunctionService] Input matches DOFunctionRawInput (via type guard). Proceeding with raw deserialization.'
      );
      const { http } = inputFromDO;
      const { body, isBase64Encoded, headers } = http;

      let decodedBody: Buffer;
      if (isBase64Encoded) {
        DR.logger.info(
          '[DOFunctionService] Body is base64 encoded, decoding...'
        );
        decodedBody = Buffer.from(body, 'base64');
      } else {
        DR.logger.info(
          '[DOFunctionService] Body is not base64 encoded, using utf8.'
        );
        decodedBody = Buffer.from(body, 'utf8');
      }

      const isBson = headers['content-type'] === 'application/octet-stream';
      let requestData: TInput;

      if (isBson) {
        DR.logger.info('[DOFunctionService] Deserializing BSON body.');
        try {
          requestData = BSON.deserialize(decodedBody) as TInput;
        } catch (bsonError) {
          DR.logger.error(
            `[DOFunctionService] BSON deserialization failed: ${String(bsonError)}. Falling back to JSON parse.`
          );
          try {
            requestData = JSON.parse(decodedBody.toString('utf8')) as TInput;
          } catch (jsonError) {
            DR.logger.error(
              `[DOFunctionService] JSON fallback parse failed: ${String(jsonError)}`
            );
            throw new Error(
              'Failed to deserialize input body as BSON or JSON.'
            );
          }
        }
      } else {
        DR.logger.info(
          '[DOFunctionService] Deserializing non-BSON body (assuming JSON).'
        );
        try {
          requestData = JSON.parse(decodedBody.toString('utf8')) as TInput;
        } catch (jsonError) {
          DR.logger.error(
            `[DOFunctionService] JSON parse failed: ${String(jsonError)}`
          );
          throw new Error('Failed to deserialize input body as JSON.');
        }
      }
      return requestData;
    }
    // 2. Assume it's already the correct TInput type
    else {
      DR.logger.info(
        '[DOFunctionService] Input does not match RawInput. Assuming input is already deserialized TInput.'
      );
      return inputFromDO;
    }
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
