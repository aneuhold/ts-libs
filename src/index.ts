import BaseDocument from './documents/BaseDocument';
import BaseDocumentWithType from './documents/BaseDocumentWithType';
import ApiKey, { validateApiKey } from './documents/common/ApiKey';
import User, { UserCTO, validateUser } from './documents/common/User';
import DashboardTask, {
  validateDashboardTask
} from './documents/dashboard/Task';
import DashboardUserConfig, {
  validateDashboardUserConfig
} from './documents/dashboard/UserConfig';
import {
  ParentRecurringTaskInfo,
  RecurrenceBasis,
  RecurrenceEffect,
  RecurrenceFrequency,
  RecurrenceFrequencyType,
  RecurrenceInfo
} from './embedded-types/dashboard/task/RecurrenceInfo';
import RequiredUserId from './schemas/required-refs/RequiredUserId';
import { DocumentValidator } from './schemas/validators/DocumentValidator';
import DocumentService from './services/DocumentService';
import DashboardTaskService from './services/dashboard/TaskService';

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
  DashboardTaskService,
  BaseDocument,
  BaseDocumentWithType,
  RequiredUserId,
  DocumentService
};

// Export TypeScript types where needed
export type {
  DocumentValidator,
  UserCTO,
  RecurrenceInfo,
  RecurrenceFrequency,
  ParentRecurringTaskInfo
};
