import type { User, WorkoutMesocycle, WorkoutMicrocycle } from '@aneuhold/core-ts-db-lib';
import { WorkoutMicrocycle_docType } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import WorkoutMicrocycleValidator from '../../validators/workout/MicrocycleValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';
import WorkoutSessionRepository from './WorkoutSessionRepository.js';

/**
 * The repository that contains {@link WorkoutMicrocycle} documents.
 */
export default class WorkoutMicrocycleRepository extends WorkoutBaseWithUserIdRepository<WorkoutMicrocycle> {
  private static singletonInstance?: WorkoutMicrocycleRepository;

  private constructor() {
    super(WorkoutMicrocycle_docType, new WorkoutMicrocycleValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const microcycleRepo = WorkoutMicrocycleRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await microcycleRepo.deleteAllForUser(userId, meta);
      },
      deleteList: async (userIds, meta) => {
        await microcycleRepo.deleteAllForUsers(userIds, meta);
      }
    };
  }

  static getListenersForMesocycleRepo(): RepoListeners<WorkoutMesocycle> {
    const microcycleRepo = WorkoutMicrocycleRepository.getRepo();
    return {
      deleteOne: async (mesocycleId, meta) => {
        await microcycleRepo.deleteAllForMesocycle(mesocycleId, meta);
      },
      deleteList: async (mesocycleIds, meta) => {
        await microcycleRepo.deleteAllForMesocycles(mesocycleIds, meta);
      }
    };
  }

  protected setupSubscribers(): void {
    this.subscribeToChanges(WorkoutSessionRepository.getListenersForMicrocycleRepo());
  }

  /**
   * Deletes all microcycles for a specific mesocycle.
   *
   * @param mesocycleId - The mesocycle ID to delete microcycles for.
   * @param meta - Tracks database operation metadata for a single request.
   */
  async deleteAllForMesocycle(mesocycleId: UUID, meta?: DbOperationMetaData): Promise<void> {
    await this.deleteAllForMesocycles([mesocycleId], meta);
  }

  /**
   * Deletes all microcycles for specific mesocycles.
   *
   * @param mesocycleIds - The mesocycle IDs to delete microcycles for.
   * @param meta - Tracks database operation metadata for a single request.
   */
  async deleteAllForMesocycles(mesocycleIds: UUID[], meta?: DbOperationMetaData): Promise<void> {
    const microcyclesForMesocycles = await (
      await this.getCollection()
    )
      .find({
        workoutMesocycleId: { $in: mesocycleIds },
        docType: WorkoutMicrocycle_docType
      })
      .toArray();

    const docIds = microcyclesForMesocycles.map((doc) => doc._id);
    if (docIds.length > 0) {
      await this.deleteList(docIds, meta);
    }
  }

  public static getRepo(): WorkoutMicrocycleRepository {
    if (!WorkoutMicrocycleRepository.singletonInstance) {
      WorkoutMicrocycleRepository.singletonInstance = new WorkoutMicrocycleRepository();
    }
    return WorkoutMicrocycleRepository.singletonInstance;
  }
}
