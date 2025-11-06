import APIService from './services/APIService/APIService.js';
import {
  DOFunctionRawInput,
  DOFunctionRawOutput
} from './services/DOFunctionService/DOFunction.js';
import DOFunctionService from './services/DOFunctionService/DOFunctionService.js';
import {
  AuthCheckPasswordInput,
  AuthCheckPasswordOutput
} from './services/DOFunctionService/functions/authCheckPassword.js';
import {
  AuthValidateUserInput,
  AuthValidateUserOutput
} from './services/DOFunctionService/functions/authValidateUser.js';
import {
  ProjectDashboardInput,
  ProjectDashboardOptions,
  ProjectDashboardOutput
} from './services/DOFunctionService/functions/projectDashboard.js';
import { APIResponse } from './types/APIResponse.js';
import { DashboardConfig } from './types/DashboardConfig.js';
import { Translation, Translations } from './types/Translations.js';

// Export all the functions and classes from this library that are browser safe (no Node.js dependencies)
export { APIService, DOFunctionService };

// Export TypeScript types where needed
export type {
  APIResponse,
  AuthCheckPasswordInput,
  AuthCheckPasswordOutput,
  AuthValidateUserInput,
  AuthValidateUserOutput,
  DashboardConfig,
  DOFunctionRawInput,
  DOFunctionRawOutput,
  ProjectDashboardInput,
  ProjectDashboardOptions,
  ProjectDashboardOutput,
  Translation,
  Translations
};
