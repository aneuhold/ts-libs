import APIService from './services/APIService/APIService.js';
import type { APIResponse } from './types/APIResponse.js';
import type { AuthCheckPasswordInput, AuthCheckPasswordOutput } from './types/AuthCheckPassword.js';
import type { AuthValidateUserInput, AuthValidateUserOutput } from './types/AuthValidateUser.js';
import type { DashboardConfig } from './types/DashboardConfig.js';
import type {
  ProjectDashboardInput,
  ProjectDashboardOptions,
  ProjectDashboardOutput
} from './types/ProjectDashboard.js';
import type { Translation, Translations } from './types/Translations.js';

// Export all browser-safe functions and classes from this library
export { APIService };

// Export TypeScript types where needed
export type {
  APIResponse,
  AuthCheckPasswordInput,
  AuthCheckPasswordOutput,
  AuthValidateUserInput,
  AuthValidateUserOutput,
  DashboardConfig,
  ProjectDashboardInput,
  ProjectDashboardOptions,
  ProjectDashboardOutput,
  Translation,
  Translations
};
