import BaseDocument from './documents/BaseDocument';
import BaseDocumentWithType from './documents/BaseDocumentWithType';
import ApiKey, { validateApiKey } from './documents/common/ApiKey';
import User, { UserCTO, validateUser } from './documents/common/User';
import DashboardTask, {
  getDashboardTaskChildrenIds,
  validateDashboardTask
} from './documents/dashboard/Task';
import DashboardUserConfig, {
  validateDashboardUserConfig
} from './documents/dashboard/UserConfig';
import {
  RecurrenceBasis,
  RecurrenceEffect,
  RecurrenceFrequency,
  RecurrenceFrequencyType,
  RecurrenceInfo
} from './embedded-types/dashboard/task/RecurrenceInfo';
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
  RecurrenceFrequencyType,
  RecurrenceBasis,
  RecurrenceEffect,
  validateDashboardTask,
  getDashboardTaskChildrenIds,
  BaseDocument,
  BaseDocumentWithType,
  RequiredUserId
};

// Export TypeScript types where needed
export type { DocumentValidator, UserCTO, RecurrenceInfo, RecurrenceFrequency };
