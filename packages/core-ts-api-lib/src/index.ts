import APIService from './services/APIService/APIService.js';
import {
  DOFunctionCallOutput,
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
import { DashboardConfig } from './types/DashboardConfig.js';
import { Translation, Translations } from './types/Translations.js';

// Export all the functions and classes from this library
export { APIService, DOFunctionService };

// Export TypeScript types where needed
export type {
  AuthCheckPasswordInput,
  AuthCheckPasswordOutput,
  AuthValidateUserInput,
  AuthValidateUserOutput,
  DashboardConfig,
  DOFunctionCallOutput,
  DOFunctionRawInput,
  DOFunctionRawOutput,
  ProjectDashboardInput,
  ProjectDashboardOptions,
  ProjectDashboardOutput,
  Translation,
  Translations
};
