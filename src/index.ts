import BaseDocument from './documents/BaseDocument';
import BaseDocumentWithType from './documents/BaseDocumentWithType';
import ApiKey, { validateApiKey } from './documents/common/ApiKey';
import User, { validateUser } from './documents/common/User';
import DashboardUserConfig, {
  validateDashboardUserConfig
} from './documents/dashboard/UserConfig';
import RequiredUserId from './schemas/required-refs/RequiredUserId';

// Export all the functions and classes from this library
export {
  User,
  validateUser,
  ApiKey,
  validateApiKey,
  DashboardUserConfig,
  validateDashboardUserConfig,
  BaseDocument,
  BaseDocumentWithType,
  RequiredUserId
};

// Export TypeScript types where needed
export type {};
