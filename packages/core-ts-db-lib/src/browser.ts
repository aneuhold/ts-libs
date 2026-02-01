import type {
  BaseDocument,
  BaseDocumentWithType,
  BaseDocumentWithUpdatedAndCreatedDates
} from './documents/BaseDocument.js';
import {
  BaseDocumentSchema,
  BaseDocumentWithTypeSchema,
  BaseDocumentWithUpdatedAndCreatedDatesSchema
} from './documents/BaseDocument.js';
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
import type { WorkoutEquipmentType } from './documents/workout/WorkoutEquipmentType.js';
import {
  WorkoutEquipmentType_docType,
  WorkoutEquipmentTypeSchema
} from './documents/workout/WorkoutEquipmentType.js';
import type { ExerciseProperty, WorkoutExercise } from './documents/workout/WorkoutExercise.js';
import {
  ExerciseProgressionType,
  ExercisePropertySchema,
  ExercisePropertyType,
  ExerciseRepRange,
  WorkoutExercise_docType,
  WorkoutExerciseSchema
} from './documents/workout/WorkoutExercise.js';
import type {
  CalibrationExercisePair,
  WorkoutExerciseCalibration
} from './documents/workout/WorkoutExerciseCalibration.js';
import {
  WorkoutExerciseCalibration_docType,
  WorkoutExerciseCalibrationSchema
} from './documents/workout/WorkoutExerciseCalibration.js';
import type { WorkoutMesocycle } from './documents/workout/WorkoutMesocycle.js';
import {
  CycleType,
  WorkoutMesocycle_docType,
  WorkoutMesocycleSchema
} from './documents/workout/WorkoutMesocycle.js';
import type { WorkoutMicrocycle } from './documents/workout/WorkoutMicrocycle.js';
import {
  WorkoutMicrocycle_docType,
  WorkoutMicrocycleSchema
} from './documents/workout/WorkoutMicrocycle.js';
import type { WorkoutMuscleGroup } from './documents/workout/WorkoutMuscleGroup.js';
import {
  WorkoutMuscleGroup_docType,
  WorkoutMuscleGroupSchema
} from './documents/workout/WorkoutMuscleGroup.js';
import type { WorkoutSession } from './documents/workout/WorkoutSession.js';
import {
  WorkoutSession_docType,
  WorkoutSessionSchema
} from './documents/workout/WorkoutSession.js';
import type { WorkoutSessionExercise } from './documents/workout/WorkoutSessionExercise.js';
import {
  WorkoutSessionExercise_docType,
  WorkoutSessionExerciseSchema
} from './documents/workout/WorkoutSessionExercise.js';
import type { WorkoutSet } from './documents/workout/WorkoutSet.js';
import { WorkoutSet_docType, WorkoutSetSchema } from './documents/workout/WorkoutSet.js';
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
import type { Fatigue } from './embedded-types/workout/Fatigue.js';
import { FatigueSchema } from './embedded-types/workout/Fatigue.js';
import type { RSM } from './embedded-types/workout/Rsm.js';
import { RsmSchema } from './embedded-types/workout/Rsm.js';
import type { RequiredUserId } from './schemas/required-refs/RequiredUserId.js';
import { RequiredUserIdSchema } from './schemas/required-refs/RequiredUserId.js';
import type { DocumentMap } from './services/DocumentService.js';
import DocumentService from './services/DocumentService.js';
import type { DashboardTaskFilterAndSortResult } from './services/dashboard/Task/TaskService.js';
import DashboardTaskService from './services/dashboard/Task/TaskService.js';
import WorkoutEquipmentTypeService from './services/workout/EquipmentType/WorkoutEquipmentTypeService.js';
import WorkoutExerciseService from './services/workout/Exercise/WorkoutExerciseService.js';
import WorkoutExerciseCalibrationService from './services/workout/ExerciseCalibration/WorkoutExerciseCalibrationService.js';
import WorkoutMesocyclePlanContext from './services/workout/Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutMesocycleService from './services/workout/Mesocycle/WorkoutMesocycleService.js';
import WorkoutMicrocycleService from './services/workout/Microcycle/WorkoutMicrocycleService.js';
import WorkoutSessionService from './services/workout/Session/WorkoutSessionService.js';
import WorkoutSessionExerciseService from './services/workout/SessionExercise/WorkoutSessionExerciseService.js';
import WorkoutSetService from './services/workout/Set/WorkoutSetService.js';
import WorkoutSFRService from './services/workout/util/SFR/WorkoutSFRService.js';

// Export all browser-safe functions and classes from this library
export {
  ApiKeySchema,
  BaseDocumentSchema,
  BaseDocumentWithTypeSchema,
  BaseDocumentWithUpdatedAndCreatedDatesSchema,
  CycleType,
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
  ExerciseProgressionType,
  ExercisePropertySchema,
  ExercisePropertyType,
  ExerciseRepRange,
  FatigueSchema,
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
  RsmSchema,
  StandardFilterSettingSchema,
  UserCTOSchema,
  UserSchema,
  WorkoutEquipmentType_docType,
  WorkoutEquipmentTypeSchema,
  WorkoutEquipmentTypeService,
  WorkoutExercise_docType,
  WorkoutExerciseCalibration_docType,
  WorkoutExerciseCalibrationSchema,
  WorkoutExerciseCalibrationService,
  WorkoutExerciseSchema,
  WorkoutExerciseService,
  WorkoutMesocycle_docType,
  WorkoutMesocyclePlanContext,
  WorkoutMesocycleSchema,
  WorkoutMesocycleService,
  WorkoutMicrocycle_docType,
  WorkoutMicrocycleSchema,
  WorkoutMicrocycleService,
  WorkoutMuscleGroup_docType,
  WorkoutMuscleGroupSchema,
  WorkoutSession_docType,
  WorkoutSessionExercise_docType,
  WorkoutSessionExerciseSchema,
  WorkoutSessionExerciseService,
  WorkoutSessionSchema,
  WorkoutSessionService,
  WorkoutSet_docType,
  WorkoutSetSchema,
  WorkoutSetService,
  WorkoutSFRService
};

// Export TypeScript types where needed
export type {
  ApiKey,
  BaseDocument,
  BaseDocumentWithType,
  BaseDocumentWithUpdatedAndCreatedDates,
  CalibrationExercisePair,
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
  ExerciseProperty,
  Fatigue,
  NonogramKatanaItem,
  NonogramKatanaUpgrade,
  ParentRecurringTaskInfo,
  RecurrenceFrequency,
  RecurrenceInfo,
  RequiredUserId,
  RSM,
  StandardFilterSetting,
  User,
  UserCTO,
  WorkoutEquipmentType,
  WorkoutExercise,
  WorkoutExerciseCalibration,
  WorkoutMesocycle,
  WorkoutMicrocycle,
  WorkoutMuscleGroup,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet
};
