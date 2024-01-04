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
   */
  static async handleApiRequest<
    TInput extends DOFunctionInput,
    TOutput extends DOFunctionOutput
  >(
    rawInput: DOFunctionRawInput,
    handler: (input: TInput) => Promise<DOFunctionCallOutput<TOutput>>
  ): Promise<DOFunctionRawOutput> {
    const input: TInput = EJSON.parse(rawInput.data);
    const output = await handler(input);
    return {
      body: {
        success: output.success,
        errors: output.errors,
        data: EJSON.stringify(output.data, { relaxed: false })
      }
    };
  }
}
