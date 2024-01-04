import { EJSON } from 'bson';
import {
  DOFunctionCallOutput,
  DOFunctionInput,
  DOFunctionOutput,
  DOFunctionRawInput,
  DOFunctionRawOutput
} from './DOFunction';
import AuthCheckPassword from './functions/authCheckPassword';
import AuthValidateUser from './functions/authValidateUser';
import ProjectDashboard from './functions/projectDashboard';

/**
 * A service to provide some utility related to Digital Ocean functions.
 */
export default class DOFunctionService {
  static auchCheckPassword = AuthCheckPassword.getFunction();

  static authValidateUser = AuthValidateUser.getFunction();

  static projectDashboard = ProjectDashboard.getFunction();

  /**
   * A generic method to handle any API request on the backend. This has
   * no use on the frontend.
   *
   * This will take care of returning the error if the handler throws.
   * Ideally the handler should not throw though unless something really
   * unexpected happened.
   */
  static async handleApiRequest<
    TInput extends DOFunctionInput,
    TOutput extends DOFunctionOutput
  >(
    rawInput: DOFunctionRawInput,
    handler: (input: TInput) => Promise<DOFunctionCallOutput<TOutput>>
  ): Promise<DOFunctionRawOutput> {
    const input: TInput = EJSON.parse(rawInput.data);
    const rawOutput: DOFunctionRawOutput = {
      body: {
        success: false,
        errors: [],
        data: ''
      }
    };
    try {
      const output = await handler(input);
      rawOutput.body.success = output.success;
      rawOutput.body.errors = output.errors;
      rawOutput.body.data = EJSON.stringify(output.data, { relaxed: false });
    } catch (error) {
      rawOutput.body.errors.push(JSON.stringify(error));
    }
    return rawOutput;
  }
}
