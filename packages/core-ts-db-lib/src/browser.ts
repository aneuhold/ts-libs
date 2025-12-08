import type { BaseDocument, BaseDocumentWithType } from './documents/BaseDocument.js';
import { BaseDocumentSchema, BaseDocumentWithTypeSchema } from './documents/BaseDocument.js';
import type { ApiKey } from './documents/common/ApiKey.js';
import { ApiKeySchema } from './documents/common/ApiKey.js';
import type { User, UserCTO } from './documents/common/User.js';
import { UserCTOSchema, UserSchema } from './documents/common/User.js';
import type { NonogramKatanaItem } from './documents/dashboard/NonogramKatanaItem.js';
import {
  NonogramKatanaItem_docType,
  NonogramKatanaItemSchema
} from './documents/dashboard/NonogramKatanaItem.js';
import type { NonogramKatanaUpgrade } from './documents/dashboard/NonogramKatanaUpgrade.js';
import {
  NonogramKatanaUpgrade_docType,
  NonogramKatanaUpgradeSchema
} from './documents/dashboard/NonogramKatanaUpgrade.js';
import type { DashboardTask, DashboardTaskMap } from './documents/dashboard/Task.js';
import { DashboardTask_docType, DashboardTaskSchema } from './documents/dashboard/Task.js';
import type { DashboardUserConfig } from './documents/dashboard/UserConfig.js';
import {
  DashboardUserConfig_docType,
  DashboardUserConfigSchema
} from './documents/dashboard/UserConfig.js';
import NonogramKatanaItemName, {
  NonogramKatanaItemNameSchema
} from './embedded-types/dashboard/nonogramKatanaItem/ItemName.js';
import NonogramKatanaUpgradeName, {
  NonogramKatanaUpgradeNameSchema
} from './embedded-types/dashboard/nonogramKatanaUpgrade/UpgradeName.js';
import type {
  DashboardTaskFilterSettings,
  DashboardTaskListFilterSettings,
  DashboardTaskListGlobalFilterSettings,
  StandardFilterSetting
} from './embedded-types/dashboard/task/FilterSettings.js';
import {
  DashboardTaskFilterSettingsSchema,
  DashboardTaskListFilterSettingsSchema,
  DashboardTaskListGlobalFilterSettingsSchema,
  StandardFilterSettingSchema
} from './embedded-types/dashboard/task/FilterSettings.js';
import type {
  ParentRecurringTaskInfo,
  RecurrenceFrequency,
  RecurrenceInfo
} from './embedded-types/dashboard/task/RecurrenceInfo.js';
import {
  ParentRecurringTaskInfoSchema,
  RecurrenceBasis,
  RecurrenceBasisSchema,
  RecurrenceEffect,
  RecurrenceEffectSchema,
  RecurrenceFrequencySchema,
  RecurrenceFrequencyType,
  RecurrenceFrequencyTypeSchema,
  RecurrenceInfoSchema
} from './embedded-types/dashboard/task/RecurrenceInfo.js';
import type {
  DashboardTaskListGlobalSortSettings,
  DashboardTaskListSortSettings,
  DashboardTaskSortSetting,
  DashboardTaskSortSettings
} from './embedded-types/dashboard/task/SortSettings.js';
import {
  DashboardTaskListGlobalSortSettingsSchema,
  DashboardTaskListSortSettingsSchema,
  DashboardTaskSortBy,
  DashboardTaskSortBySchema,
  DashboardTaskSortDirection,
  DashboardTaskSortDirectionSchema,
  DashboardTaskSortSettingSchema,
  DashboardTaskSortSettingsSchema
} from './embedded-types/dashboard/task/SortSettings.js';
import type {
  DashboardTagSetting,
  DashboardTagSettings
} from './embedded-types/dashboard/userConfig/Tags.js';
import {
  DashboardTagSettingSchema,
  DashboardTagSettingsSchema
} from './embedded-types/dashboard/userConfig/Tags.js';
import type { RequiredUserId } from './schemas/required-refs/RequiredUserId.js';
import { RequiredUserIdSchema } from './schemas/required-refs/RequiredUserId.js';
import type { DocumentMap } from './services/DocumentService.js';
import DocumentService from './services/DocumentService.js';
import type { DashboardTaskFilterAndSortResult } from './services/dashboard/Task/TaskService.js';
import DashboardTaskService from './services/dashboard/Task/TaskService.js';

// Export all browser-safe functions and classes from this library
export {
  ApiKeySchema,
  BaseDocumentSchema,
  BaseDocumentWithTypeSchema,
  DashboardTagSettingSchema,
  DashboardTagSettingsSchema,
  DashboardTask_docType,
  DashboardTaskFilterSettingsSchema,
  DashboardTaskListFilterSettingsSchema,
  DashboardTaskListGlobalFilterSettingsSchema,
  DashboardTaskListGlobalSortSettingsSchema,
  DashboardTaskListSortSettingsSchema,
  DashboardTaskSchema,
  DashboardTaskService,
  DashboardTaskSortBy,
  DashboardTaskSortBySchema,
  DashboardTaskSortDirection,
  DashboardTaskSortDirectionSchema,
  DashboardTaskSortSettingSchema,
  DashboardTaskSortSettingsSchema,
  DashboardUserConfig_docType,
  DashboardUserConfigSchema,
  DocumentService,
  NonogramKatanaItem_docType,
  NonogramKatanaItemName,
  NonogramKatanaItemNameSchema,
  NonogramKatanaItemSchema,
  NonogramKatanaUpgrade_docType,
  NonogramKatanaUpgradeName,
  NonogramKatanaUpgradeNameSchema,
  NonogramKatanaUpgradeSchema,
  ParentRecurringTaskInfoSchema,
  RecurrenceBasis,
  RecurrenceBasisSchema,
  RecurrenceEffect,
  RecurrenceEffectSchema,
  RecurrenceFrequencySchema,
  RecurrenceFrequencyType,
  RecurrenceFrequencyTypeSchema,
  RecurrenceInfoSchema,
  RequiredUserIdSchema,
  StandardFilterSettingSchema,
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
  NonogramKatanaItem,
  NonogramKatanaUpgrade,
  ParentRecurringTaskInfo,
  RecurrenceFrequency,
  RecurrenceInfo,
  RequiredUserId,
  StandardFilterSetting,
  User,
  UserCTO
};
