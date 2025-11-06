import BaseDocument from './documents/BaseDocument.js';
import BaseDocumentWithType from './documents/BaseDocumentWithType.js';
import ApiKey, { validateApiKey } from './documents/common/ApiKey.js';
import User, { UserCTO, validateUser } from './documents/common/User.js';
import NonogramKatanaItem, {
  validateNonogramKatanaItem
} from './documents/dashboard/NonogramKatanaItem.js';
import NonogramKatanaUpgrade, {
  validateNonogramKatanaUpgrade
} from './documents/dashboard/NonogramKatanaUpgrade.js';
import DashboardTask, {
  DashboardTaskMap,
  validateDashboardTask
} from './documents/dashboard/Task.js';
import DashboardUserConfig, {
  validateDashboardUserConfig
} from './documents/dashboard/UserConfig.js';
import NonogramKatanaItemName from './embedded-types/dashboard/nonogramKatanaItem/ItemName.js';
import NonogramKatanaUpgradeName from './embedded-types/dashboard/nonogramKatanaUpgrade/UpgradeName.js';
import {
  DashboardTaskFilterSettings,
  DashboardTaskListFilterSettings,
  DashboardTaskListGlobalFilterSettings,
  getDefaultTaskListFilterSettings
} from './embedded-types/dashboard/task/FilterSettings.js';
import {
  ParentRecurringTaskInfo,
  RecurrenceBasis,
  RecurrenceEffect,
  RecurrenceFrequency,
  RecurrenceFrequencyType,
  RecurrenceInfo
} from './embedded-types/dashboard/task/RecurrenceInfo.js';
import {
  DashboardTaskListGlobalSortSettings,
  DashboardTaskListSortSettings,
  DashboardTaskSortBy,
  DashboardTaskSortDirection,
  DashboardTaskSortSetting,
  DashboardTaskSortSettings,
  getDefaultTaskListSortSettings
} from './embedded-types/dashboard/task/SortSettings.js';
import {
  DashboardTagSetting,
  DashboardTagSettings
} from './embedded-types/dashboard/userConfig/Tags.js';
import RequiredUserId from './schemas/required-refs/RequiredUserId.js';
import { DocumentValidator } from './schemas/validators/DocumentValidator.js';
import DocumentService, { DocumentMap } from './services/DocumentService.js';
import DashboardTaskService, {
  DashboardTaskFilterAndSortResult
} from './services/dashboard/Task/TaskService.js';

// Export all browser-safe functions and classes from this library
export {
  ApiKey,
  BaseDocument,
  BaseDocumentWithType,
  DashboardTask,
  DashboardTaskService,
  DashboardTaskSortBy,
  DashboardTaskSortDirection,
  DashboardUserConfig,
  DocumentService,
  getDefaultTaskListFilterSettings,
  getDefaultTaskListSortSettings,
  NonogramKatanaItem,
  NonogramKatanaItemName,
  NonogramKatanaUpgrade,
  NonogramKatanaUpgradeName,
  RecurrenceBasis,
  RecurrenceEffect,
  RecurrenceFrequencyType,
  RequiredUserId,
  User,
  validateApiKey,
  validateDashboardTask,
  validateDashboardUserConfig,
  validateNonogramKatanaItem,
  validateNonogramKatanaUpgrade,
  validateUser
};

// Export TypeScript types where needed
export type {
  DashboardTagSetting,
  DashboardTagSettings,
  DashboardTaskFilterAndSortResult,
  DashboardTaskFilterSettings,
  DashboardTaskListFilterSettings,
  DashboardTaskListGlobalFilterSettings,
  DashboardTaskListGlobalSortSettings,
  DashboardTaskListSortSettings,
  DashboardTaskMap,
  DashboardTaskSortSetting,
  DashboardTaskSortSettings,
  DocumentMap,
  DocumentValidator,
  ParentRecurringTaskInfo,
  RecurrenceFrequency,
  RecurrenceInfo,
  UserCTO
};
