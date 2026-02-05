import ApiKeyValidator from '../validators/common/ApiKeyValidator.js';
import UserValidator from '../validators/common/UserValidator.js';
import DashboardNonogramKatanaItemValidator from '../validators/dashboard/NonogramKatanaItemValidator.js';
import DashboardNonogramKatanaUpgradeValidator from '../validators/dashboard/NonogramKatanaUpgradeValidator.js';
import DashboardTaskValidator from '../validators/dashboard/TaskValidator.js';
import DashboardUserConfigValidator from '../validators/dashboard/UserConfigValidator.js';
import WorkoutEquipmentTypeValidator from '../validators/workout/EquipmentTypeValidator.js';
import WorkoutExerciseCalibrationValidator from '../validators/workout/ExerciseCalibrationValidator.js';
import WorkoutExerciseValidator from '../validators/workout/ExerciseValidator.js';
import WorkoutMesocycleValidator from '../validators/workout/MesocycleValidator.js';
import WorkoutMicrocycleValidator from '../validators/workout/MicrocycleValidator.js';
import WorkoutMuscleGroupValidator from '../validators/workout/MuscleGroupValidator.js';

/**
 * A class that can be used to validate and update the DB and all repositories.
 */
export default class DbSchemaUpdater {
  static async updateSchemaForAllRepos(dryRun = false): Promise<void> {
    // Common validators
    await new UserValidator().validateRepositoryInDb(dryRun);
    await new ApiKeyValidator().validateRepositoryInDb(dryRun);

    // Dashboard validators
    await new DashboardUserConfigValidator().validateRepositoryInDb(dryRun);
    await new DashboardTaskValidator().validateRepositoryInDb(dryRun);
    await new DashboardNonogramKatanaItemValidator().validateRepositoryInDb(dryRun);
    await new DashboardNonogramKatanaUpgradeValidator().validateRepositoryInDb(dryRun);

    // Workout validators
    await new WorkoutEquipmentTypeValidator().validateRepositoryInDb(dryRun);
    await new WorkoutExerciseCalibrationValidator().validateRepositoryInDb(dryRun);
    await new WorkoutExerciseValidator().validateRepositoryInDb(dryRun);
    await new WorkoutMesocycleValidator().validateRepositoryInDb(dryRun);
    await new WorkoutMicrocycleValidator().validateRepositoryInDb(dryRun);
    await new WorkoutMuscleGroupValidator().validateRepositoryInDb(dryRun);
  }
}
