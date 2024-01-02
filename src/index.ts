import BaseDocument from './documents/BaseDocument';
import BaseDocumentWithType from './documents/BaseDocumentWithType';
import ApiKey, { validateApiKey } from './documents/common/ApiKey';
import User, { validateUser } from './documents/common/User';
import DashboardTask, {
  validateDashboardTask
} from './documents/dashboard/Task';
import DashboardUserConfig, {
  validateDashboardUserConfig
} from './documents/dashboard/UserConfig';
import RequiredUserId from './schemas/required-refs/RequiredUserId';
import { DocumentValidator } from './schemas/validators/DocumentValidator';

// Export all the functions and classes from this library
export {
  User,
  validateUser,
  ApiKey,
  validateApiKey,
  DashboardUserConfig,
  validateDashboardUserConfig,
  DashboardTask,
  validateDashboardTask,
  BaseDocument,
  BaseDocumentWithType,
  RequiredUserId
};

// Export TypeScript types where needed
export type { DocumentValidator };
