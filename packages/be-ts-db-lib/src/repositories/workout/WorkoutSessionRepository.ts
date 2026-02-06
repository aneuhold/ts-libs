import type { User, WorkoutMicrocycle, WorkoutSession } from '@aneuhold/core-ts-db-lib';
import { WorkoutSession_docType } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import WorkoutSessionValidator from '../../validators/workout/SessionValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';
import WorkoutSessionExerciseRepository from './WorkoutSessionExerciseRepository.js';

/**
 * The repository that contains {@link WorkoutSession} documents.
 */
export default class WorkoutSessionRepository extends WorkoutBaseWithUserIdRepository<WorkoutSession> {
  private static singletonInstance?: WorkoutSessionRepository;

  private constructor() {
    super(WorkoutSession_docType, new WorkoutSessionValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const sessionRepo = WorkoutSessionRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await sessionRepo.deleteAllForUser(userId, meta);
      },
      deleteList: async (userIds, meta) => {
        await sessionRepo.deleteAllForUsers(userIds, meta);
      }
    };
  }

  static getListenersForMicrocycleRepo(): RepoListeners<WorkoutMicrocycle> {
    const sessionRepo = WorkoutSessionRepository.getRepo();
    return {
      deleteOne: async (microcycleId, meta) => {
        await sessionRepo.deleteAllForMicrocycle(microcycleId, meta);
      },
      deleteList: async (microcycleIds, meta) => {
        await sessionRepo.deleteAllForMicrocycles(microcycleIds, meta);
      }
    };
  }

  protected setupSubscribers(): void {
    this.subscribeToChanges(WorkoutSessionExerciseRepository.getListenersForSessionRepo());
  }

  /**
   * Deletes all sessions for a specific microcycle.
   *
   * @param microcycleId - The microcycle ID to delete sessions for.
   * @param meta - Tracks database operation metadata for a single request.
   */
  async deleteAllForMicrocycle(microcycleId: UUID, meta?: DbOperationMetaData): Promise<void> {
    await this.deleteAllForMicrocycles([microcycleId], meta);
  }

  /**
   * Deletes all sessions for specific microcycles.
   *
   * @param microcycleIds - The microcycle IDs to delete sessions for.
   * @param meta - Tracks database operation metadata for a single request.
   */
  async deleteAllForMicrocycles(microcycleIds: UUID[], meta?: DbOperationMetaData): Promise<void> {
    const sessionsForMicrocycles = await (
      await this.getCollection()
    )
      .find({
        workoutMicrocycleId: { $in: microcycleIds },
        docType: WorkoutSession_docType
      })
      .toArray();

    const docIds = sessionsForMicrocycles.map((doc) => doc._id);
    if (docIds.length > 0) {
      await this.deleteList(docIds, meta);
    }
  }

  public static getRepo(): WorkoutSessionRepository {
    if (!WorkoutSessionRepository.singletonInstance) {
      WorkoutSessionRepository.singletonInstance = new WorkoutSessionRepository();
    }
    return WorkoutSessionRepository.singletonInstance;
  }
}
