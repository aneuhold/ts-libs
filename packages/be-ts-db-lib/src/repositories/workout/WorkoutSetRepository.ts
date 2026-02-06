import type { User, WorkoutSessionExercise, WorkoutSet } from '@aneuhold/core-ts-db-lib';
import { WorkoutSet_docType } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import WorkoutSetValidator from '../../validators/workout/SetValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link WorkoutSet} documents.
 */
export default class WorkoutSetRepository extends WorkoutBaseWithUserIdRepository<WorkoutSet> {
  private static singletonInstance?: WorkoutSetRepository;

  private constructor() {
    super(WorkoutSet_docType, new WorkoutSetValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const setRepo = WorkoutSetRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await setRepo.deleteAllForUser(userId, meta);
      },
      deleteList: async (userIds, meta) => {
        await setRepo.deleteAllForUsers(userIds, meta);
      }
    };
  }

  static getListenersForSessionExerciseRepo(): RepoListeners<WorkoutSessionExercise> {
    const setRepo = WorkoutSetRepository.getRepo();
    return {
      deleteOne: async (sessionExerciseId, meta) => {
        await setRepo.deleteAllForSessionExercise(sessionExerciseId, meta);
      },
      deleteList: async (sessionExerciseIds, meta) => {
        await setRepo.deleteAllForSessionExercises(sessionExerciseIds, meta);
      }
    };
  }

  protected setupSubscribers(): void {}

  /**
   * Deletes all sets for a specific session exercise.
   *
   * @param sessionExerciseId - The session exercise ID to delete sets for.
   * @param meta - Tracks database operation metadata for a single request.
   */
  async deleteAllForSessionExercise(
    sessionExerciseId: UUID,
    meta?: DbOperationMetaData
  ): Promise<void> {
    await this.deleteAllForSessionExercises([sessionExerciseId], meta);
  }

  /**
   * Deletes all sets for specific session exercises.
   *
   * @param sessionExerciseIds - The session exercise IDs to delete sets for.
   * @param meta - Tracks database operation metadata for a single request.
   */
  async deleteAllForSessionExercises(
    sessionExerciseIds: UUID[],
    meta?: DbOperationMetaData
  ): Promise<void> {
    const setsForSessionExercises = await (
      await this.getCollection()
    )
      .find({
        workoutSessionExerciseId: { $in: sessionExerciseIds },
        docType: WorkoutSet_docType
      })
      .toArray();

    const docIds = setsForSessionExercises.map((doc) => doc._id);
    if (docIds.length > 0) {
      await this.deleteList(docIds, meta);
    }
  }

  public static getRepo(): WorkoutSetRepository {
    if (!WorkoutSetRepository.singletonInstance) {
      WorkoutSetRepository.singletonInstance = new WorkoutSetRepository();
    }
    return WorkoutSetRepository.singletonInstance;
  }
}
