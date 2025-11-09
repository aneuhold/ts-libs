import APIService from './services/APIService/APIService.js';
import type {
  DOFunctionRawInput,
  DOFunctionRawOutput
} from './services/DOFunctionService/DOFunction.js';
import DOFunctionService from './services/DOFunctionService/DOFunctionService.js';
import type {
  AuthCheckPasswordInput,
  AuthCheckPasswordOutput
} from './services/DOFunctionService/functions/authCheckPassword.js';
import type {
  AuthValidateUserInput,
  AuthValidateUserOutput
} from './services/DOFunctionService/functions/authValidateUser.js';
import type {
  ProjectDashboardInput,
  ProjectDashboardOptions,
  ProjectDashboardOutput
} from './services/DOFunctionService/functions/projectDashboard.js';
import type { APIResponse } from './types/APIResponse.js';
import type { DashboardConfig } from './types/DashboardConfig.js';
import type { Translation, Translations } from './types/Translations.js';

// Export all browser-safe functions and classes from this library
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
