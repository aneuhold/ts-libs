import BaseDocument from './documents/BaseDocument.js';
import BaseDocumentWithType from './documents/BaseDocumentWithType.js';
import ApiKey, { validateApiKey } from './documents/common/ApiKey.js';
import type { UserCTO } from './documents/common/User.js';
import User, { validateUser } from './documents/common/User.js';
import NonogramKatanaItem, {
  validateNonogramKatanaItem
} from './documents/dashboard/NonogramKatanaItem.js';
import NonogramKatanaUpgrade, {
  validateNonogramKatanaUpgrade
} from './documents/dashboard/NonogramKatanaUpgrade.js';
import type { DashboardTaskMap } from './documents/dashboard/Task.js';
import DashboardTask, { validateDashboardTask } from './documents/dashboard/Task.js';
import DashboardUserConfig, {
  validateDashboardUserConfig
} from './documents/dashboard/UserConfig.js';
import NonogramKatanaItemName from './embedded-types/dashboard/nonogramKatanaItem/ItemName.js';
import NonogramKatanaUpgradeName from './embedded-types/dashboard/nonogramKatanaUpgrade/UpgradeName.js';
import type {
  DashboardTaskFilterSettings,
  DashboardTaskListFilterSettings,
  DashboardTaskListGlobalFilterSettings
} from './embedded-types/dashboard/task/FilterSettings.js';
import { getDefaultTaskListFilterSettings } from './embedded-types/dashboard/task/FilterSettings.js';
import type {
  ParentRecurringTaskInfo,
  RecurrenceFrequency,
  RecurrenceInfo
} from './embedded-types/dashboard/task/RecurrenceInfo.js';
import {
  RecurrenceBasis,
  RecurrenceEffect,
  RecurrenceFrequencyType
} from './embedded-types/dashboard/task/RecurrenceInfo.js';
import type {
  DashboardTaskListGlobalSortSettings,
  DashboardTaskListSortSettings,
  DashboardTaskSortSetting,
  DashboardTaskSortSettings
} from './embedded-types/dashboard/task/SortSettings.js';
import {
  DashboardTaskSortBy,
  DashboardTaskSortDirection,
  getDefaultTaskListSortSettings
} from './embedded-types/dashboard/task/SortSettings.js';
import type {
  DashboardTagSetting,
  DashboardTagSettings
} from './embedded-types/dashboard/userConfig/Tags.js';
import RequiredUserId from './schemas/required-refs/RequiredUserId.js';
import type { DocumentValidator } from './schemas/validators/DocumentValidator.js';
import type { DocumentMap } from './services/DocumentService.js';
import DocumentService from './services/DocumentService.js';
import type { DashboardTaskFilterAndSortResult } from './services/dashboard/Task/TaskService.js';
import DashboardTaskService from './services/dashboard/Task/TaskService.js';

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
