import APIService from './services/APIService/APIService';
import DOFunctionService from './services/DOFunctionService/DOFunctionService';
import {
  AuthCheckPasswordInput,
  AuthCheckPasswordOutput,
  AuthCheckPasswordRawOutput
} from './services/DOFunctionService/functions/authCheckPassword';
import {
  AuthValidateUserInput,
  AuthValidateUserOutput,
  AuthValidateUserRawOutput
} from './services/DOFunctionService/functions/authValidateUser';

// Export all the functions and classes from this library
export { DOFunctionService, APIService };

// Export TypeScript types where needed
export type {
  AuthCheckPasswordInput,
  AuthCheckPasswordOutput,
  AuthCheckPasswordRawOutput,
  AuthValidateUserInput,
  AuthValidateUserOutput,
  AuthValidateUserRawOutput
};
