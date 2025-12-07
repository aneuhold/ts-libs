import type { BaseDocument, BaseDocumentWithType } from './documents/BaseDocument.js';
import { BaseDocumentSchema, BaseDocumentWithTypeSchema } from './documents/BaseDocument.js';
import type { ApiKey } from './documents/common/ApiKey.js';
import { ApiKeySchema } from './documents/common/ApiKey.js';
import type { User, UserCTO } from './documents/common/User.js';
import { UserCTOSchema, UserSchema } from './documents/common/User.js';
import type { NonogramKatanaItem } from './documents/dashboard/NonogramKatanaItem.js';
import { NonogramKatanaItemSchema } from './documents/dashboard/NonogramKatanaItem.js';
import type { NonogramKatanaUpgrade } from './documents/dashboard/NonogramKatanaUpgrade.js';
import { NonogramKatanaUpgradeSchema } from './documents/dashboard/NonogramKatanaUpgrade.js';
import type { DashboardTask, DashboardTaskMap } from './documents/dashboard/Task.js';
import { DashboardTaskSchema } from './documents/dashboard/Task.js';
import type { DashboardUserConfig } from './documents/dashboard/UserConfig.js';
import { DashboardUserConfigSchema } from './documents/dashboard/UserConfig.js';
import NonogramKatanaItemName from './embedded-types/dashboard/nonogramKatanaItem/ItemName.js';
import NonogramKatanaUpgradeName from './embedded-types/dashboard/nonogramKatanaUpgrade/UpgradeName.js';
import type {
  DashboardTaskFilterSettings,
  DashboardTaskListFilterSettings,
  DashboardTaskListGlobalFilterSettings
} from './embedded-types/dashboard/task/FilterSettings.js';
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
  DashboardTaskSortDirection
} from './embedded-types/dashboard/task/SortSettings.js';
import type {
  DashboardTagSetting,
  DashboardTagSettings
} from './embedded-types/dashboard/userConfig/Tags.js';
import type { RequiredUserId } from './schemas/required-refs/RequiredUserId.js';
import { RequiredUserIdSchema } from './schemas/required-refs/RequiredUserId.js';
import type { DocumentValidator } from './schemas/validators/DocumentValidator.js';
import type { DocumentMap } from './services/DocumentService.js';
import DocumentService from './services/DocumentService.js';
import type { DashboardTaskFilterAndSortResult } from './services/dashboard/Task/TaskService.js';
import DashboardTaskService from './services/dashboard/Task/TaskService.js';

// Export all browser-safe functions and classes from this library
export {
  ApiKeySchema,
  BaseDocumentSchema,
  BaseDocumentWithTypeSchema,
  DashboardTaskSchema,
  DashboardTaskService,
  DashboardTaskSortBy,
  DashboardTaskSortDirection,
  DashboardUserConfigSchema,
  DocumentService,
  NonogramKatanaItemName,
  NonogramKatanaItemSchema,
  NonogramKatanaUpgradeName,
  NonogramKatanaUpgradeSchema,
  RecurrenceBasis,
  RecurrenceEffect,
  RecurrenceFrequencyType,
  RequiredUserIdSchema,
  UserCTOSchema,
  UserSchema
};

// Export TypeScript types where needed
export type {
  ApiKey,
  BaseDocument,
  BaseDocumentWithType,
  DashboardTagSetting,
  DashboardTagSettings,
  DashboardTask,
  DashboardTaskFilterAndSortResult,
  DashboardTaskFilterSettings,
  DashboardTaskListFilterSettings,
  DashboardTaskListGlobalFilterSettings,
  DashboardTaskListGlobalSortSettings,
  DashboardTaskListSortSettings,
  DashboardTaskMap,
  DashboardTaskSortSetting,
  DashboardTaskSortSettings,
  DashboardUserConfig,
  DocumentMap,
  DocumentValidator,
  NonogramKatanaItem,
  NonogramKatanaUpgrade,
  ParentRecurringTaskInfo,
  RecurrenceFrequency,
  RecurrenceInfo,
  RequiredUserId,
  User,
  UserCTO
};
