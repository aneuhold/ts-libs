import type { User, WorkoutSession, WorkoutSessionExercise } from '@aneuhold/core-ts-db-lib';
import { WorkoutSessionExercise_docType } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import WorkoutSessionExerciseValidator from '../../validators/workout/SessionExerciseValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';
import WorkoutSetRepository from './WorkoutSetRepository.js';

/**
 * The repository that contains {@link WorkoutSessionExercise} documents.
 */
export default class WorkoutSessionExerciseRepository extends WorkoutBaseWithUserIdRepository<WorkoutSessionExercise> {
  private static singletonInstance?: WorkoutSessionExerciseRepository;

  private constructor() {
    super(WorkoutSessionExercise_docType, new WorkoutSessionExerciseValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const sessionExerciseRepo = WorkoutSessionExerciseRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await sessionExerciseRepo.deleteAllForUser(userId, meta);
      },
      deleteList: async (userIds, meta) => {
        await sessionExerciseRepo.deleteAllForUsers(userIds, meta);
      }
    };
  }

  static getListenersForSessionRepo(): RepoListeners<WorkoutSession> {
    const sessionExerciseRepo = WorkoutSessionExerciseRepository.getRepo();
    return {
      deleteOne: async (sessionId, meta) => {
        await sessionExerciseRepo.deleteAllForSession(sessionId, meta);
      },
      deleteList: async (sessionIds, meta) => {
        await sessionExerciseRepo.deleteAllForSessions(sessionIds, meta);
      }
    };
  }

  protected setupSubscribers(): void {
    this.subscribeToChanges(WorkoutSetRepository.getListenersForSessionExerciseRepo());
  }

  /**
   * Deletes all session exercises for a specific session.
   *
   * @param sessionId - The session ID to delete session exercises for.
   * @param meta - Tracks database operation metadata for a single request.
   */
  async deleteAllForSession(sessionId: UUID, meta?: DbOperationMetaData): Promise<void> {
    await this.deleteAllForSessions([sessionId], meta);
  }

  /**
   * Deletes all session exercises for specific sessions.
   *
   * @param sessionIds - The session IDs to delete session exercises for.
   * @param meta - Tracks database operation metadata for a single request.
   */
  async deleteAllForSessions(sessionIds: UUID[], meta?: DbOperationMetaData): Promise<void> {
    const sessionExercisesForSessions = await (
      await this.getCollection()
    )
      .find({
        workoutSessionId: { $in: sessionIds },
        docType: WorkoutSessionExercise_docType
      })
      .toArray();

    const docIds = sessionExercisesForSessions.map((doc) => doc._id);
    if (docIds.length > 0) {
      await this.deleteList(docIds, meta);
    }
  }

  public static getRepo(): WorkoutSessionExerciseRepository {
    if (!WorkoutSessionExerciseRepository.singletonInstance) {
      WorkoutSessionExerciseRepository.singletonInstance = new WorkoutSessionExerciseRepository();
    }
    return WorkoutSessionExerciseRepository.singletonInstance;
  }
}
