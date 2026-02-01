import type { User, WorkoutExercise, WorkoutExerciseCalibration } from '@aneuhold/core-ts-db-lib';
import { WorkoutExerciseCalibration_docType } from '@aneuhold/core-ts-db-lib';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import WorkoutExerciseCalibrationValidator from '../../validators/workout/ExerciseCalibrationValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link WorkoutExerciseCalibration} documents.
 */
export default class WorkoutExerciseCalibrationRepository extends WorkoutBaseWithUserIdRepository<WorkoutExerciseCalibration> {
  private static singletonInstance?: WorkoutExerciseCalibrationRepository;

  private constructor() {
    super(WorkoutExerciseCalibration_docType, new WorkoutExerciseCalibrationValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const calibrationRepo = WorkoutExerciseCalibrationRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await (
          await calibrationRepo.getCollection()
        ).deleteMany({
          userId,
          docType: WorkoutExerciseCalibration_docType
        });
        meta?.recordDocTypeTouched(WorkoutExerciseCalibration_docType);
        meta?.addAffectedUserIds([userId]);
      },
      deleteList: async (userIds, meta) => {
        await (
          await calibrationRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds },
          docType: WorkoutExerciseCalibration_docType
        });
        meta?.recordDocTypeTouched(WorkoutExerciseCalibration_docType);
        meta?.addAffectedUserIds(userIds);
      }
    };
  }

  static getListenersForExerciseRepo(): RepoListeners<WorkoutExercise> {
    const calibrationRepo = WorkoutExerciseCalibrationRepository.getRepo();
    return {
      deleteOne: async (exerciseId, meta) => {
        await (
          await calibrationRepo.getCollection()
        ).deleteMany({
          workoutExerciseId: exerciseId,
          docType: WorkoutExerciseCalibration_docType
        });
        meta?.recordDocTypeTouched(WorkoutExerciseCalibration_docType);
      },
      deleteList: async (exerciseIds, meta) => {
        await (
          await calibrationRepo.getCollection()
        ).deleteMany({
          workoutExerciseId: { $in: exerciseIds },
          docType: WorkoutExerciseCalibration_docType
        });
        meta?.recordDocTypeTouched(WorkoutExerciseCalibration_docType);
      }
    };
  }

  protected setupSubscribers(): void {}

  public static getRepo(): WorkoutExerciseCalibrationRepository {
    if (!WorkoutExerciseCalibrationRepository.singletonInstance) {
      WorkoutExerciseCalibrationRepository.singletonInstance =
        new WorkoutExerciseCalibrationRepository();
    }
    return WorkoutExerciseCalibrationRepository.singletonInstance;
  }
}
