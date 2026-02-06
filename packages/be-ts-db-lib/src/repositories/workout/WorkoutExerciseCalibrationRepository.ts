import type { User, WorkoutExercise, WorkoutExerciseCalibration } from '@aneuhold/core-ts-db-lib';
import { WorkoutExerciseCalibration_docType } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
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
        await calibrationRepo.deleteAllForUser(userId, meta);
      },
      deleteList: async (userIds, meta) => {
        await calibrationRepo.deleteAllForUsers(userIds, meta);
      }
    };
  }

  static getListenersForExerciseRepo(): RepoListeners<WorkoutExercise> {
    const calibrationRepo = WorkoutExerciseCalibrationRepository.getRepo();
    return {
      deleteOne: async (exerciseId, meta) => {
        await calibrationRepo.deleteAllForExercise(exerciseId, meta);
      },
      deleteList: async (exerciseIds, meta) => {
        await calibrationRepo.deleteAllForExercises(exerciseIds, meta);
      }
    };
  }

  protected setupSubscribers(): void {}

  /**
   * Deletes all calibrations for a specific exercise.
   *
   * @param exerciseId - The exercise ID to delete calibrations for.
   * @param meta - Tracks database operation metadata for a single request.
   */
  async deleteAllForExercise(exerciseId: UUID, meta?: DbOperationMetaData): Promise<void> {
    await this.deleteAllForExercises([exerciseId], meta);
  }

  /**
   * Deletes all calibrations for specific exercises.
   *
   * @param exerciseIds - The exercise IDs to delete calibrations for.
   * @param meta - Tracks database operation metadata for a single request.
   */
  async deleteAllForExercises(exerciseIds: UUID[], meta?: DbOperationMetaData): Promise<void> {
    const calibrationsForExercises = await (
      await this.getCollection()
    )
      .find({
        workoutExerciseId: { $in: exerciseIds },
        docType: WorkoutExerciseCalibration_docType
      })
      .toArray();

    const docIds = calibrationsForExercises.map((doc) => doc._id);
    if (docIds.length > 0) {
      await this.deleteList(docIds, meta);
    }
  }

  public static getRepo(): WorkoutExerciseCalibrationRepository {
    if (!WorkoutExerciseCalibrationRepository.singletonInstance) {
      WorkoutExerciseCalibrationRepository.singletonInstance =
        new WorkoutExerciseCalibrationRepository();
    }
    return WorkoutExerciseCalibrationRepository.singletonInstance;
  }
}
