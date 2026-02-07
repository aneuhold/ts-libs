import BaseRepository from './repositories/BaseRepository.js';
import ApiKeyRepository from './repositories/common/ApiKeyRepository.js';
import UserRepository from './repositories/common/UserRepository.js';
import DashboardBaseRepository from './repositories/dashboard/DashboardBaseRepository.js';
import DashboardBaseWithUserIdRepository from './repositories/dashboard/DashboardBaseWithUserIdRepository.js';
import DashboardNonogramKatanaItemRepository from './repositories/dashboard/DashboardNonogramKatanaItemRepository.js';
import DashboardNonogramKatanaUpgradeRepository from './repositories/dashboard/DashboardNonogramKatanaUpgradeRepository.js';
import DashboardTaskRepository from './repositories/dashboard/DashboardTaskRepository.js';
import DashboardUserConfigRepository from './repositories/dashboard/DashboardUserConfigRepository.js';
import WorkoutBaseRepository from './repositories/workout/WorkoutBaseRepository.js';
import WorkoutBaseWithUserIdRepository from './repositories/workout/WorkoutBaseWithUserIdRepository.js';
import WorkoutEquipmentTypeRepository from './repositories/workout/WorkoutEquipmentTypeRepository.js';
import WorkoutExerciseCalibrationRepository from './repositories/workout/WorkoutExerciseCalibrationRepository.js';
import WorkoutExerciseRepository from './repositories/workout/WorkoutExerciseRepository.js';
import WorkoutMesocycleRepository from './repositories/workout/WorkoutMesocycleRepository.js';
import WorkoutMicrocycleRepository from './repositories/workout/WorkoutMicrocycleRepository.js';
import WorkoutMuscleGroupRepository from './repositories/workout/WorkoutMuscleGroupRepository.js';
import WorkoutSessionExerciseRepository from './repositories/workout/WorkoutSessionExerciseRepository.js';
import WorkoutSessionRepository from './repositories/workout/WorkoutSessionRepository.js';
import WorkoutSetRepository from './repositories/workout/WorkoutSetRepository.js';
import DbOperationMetaData from './util/DbOperationMetaData.js';
import DocumentDb from './util/DocumentDb.js';

// Export all the functions and classes from this library
export {
  ApiKeyRepository,
  BaseRepository,
  DashboardBaseRepository,
  DashboardBaseWithUserIdRepository,
  DashboardNonogramKatanaItemRepository,
  DashboardNonogramKatanaUpgradeRepository,
  DashboardTaskRepository,
  DashboardUserConfigRepository,
  DbOperationMetaData,
  DocumentDb,
  UserRepository,
  WorkoutBaseRepository,
  WorkoutBaseWithUserIdRepository,
  WorkoutEquipmentTypeRepository,
  WorkoutExerciseCalibrationRepository,
  WorkoutExerciseRepository,
  WorkoutMesocycleRepository,
  WorkoutMicrocycleRepository,
  WorkoutMuscleGroupRepository,
  WorkoutSessionExerciseRepository,
  WorkoutSessionRepository,
  WorkoutSetRepository
};

// Export TypeScript types where needed
export type {};
