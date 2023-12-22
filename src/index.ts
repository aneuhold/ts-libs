import APIService from './services/APIService/APIService';
import { DOFunctionRawOutput } from './services/DOFunctionService/DOFunction';
import DOFunctionService from './services/DOFunctionService/DOFunctionService';
import {
  AuthCheckPasswordInput,
  AuthCheckPasswordOutput
} from './services/DOFunctionService/functions/authCheckPassword';
import {
  AuthValidateUserInput,
  AuthValidateUserOutput
} from './services/DOFunctionService/functions/authValidateUser';
import {
  ProjectDashboardInput,
  ProjectDashboardOptions,
  ProjectDashboardOutput
} from './services/DOFunctionService/functions/projectDashboard';
import { DashboardConfig } from './types/DashboardConfig';
import { Translation, Translations } from './types/Translations';

// Export all the functions and classes from this library
export { DOFunctionService, APIService };

// Export TypeScript types where needed
export type {
  DOFunctionRawOutput,
  AuthCheckPasswordInput,
  AuthCheckPasswordOutput,
  AuthValidateUserInput,
  AuthValidateUserOutput,
  ProjectDashboardInput,
  ProjectDashboardOutput,
  ProjectDashboardOptions,
  DashboardConfig,
  Translations,
  Translation
};
