import type { User, WorkoutMesocycle } from '@aneuhold/core-ts-db-lib';
import { WorkoutMesocycle_docType } from '@aneuhold/core-ts-db-lib';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import WorkoutMesocycleValidator from '../../validators/workout/MesocycleValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';
import WorkoutMicrocycleRepository from './WorkoutMicrocycleRepository.js';

/**
 * The repository that contains {@link WorkoutMesocycle} documents.
 */
export default class WorkoutMesocycleRepository extends WorkoutBaseWithUserIdRepository<WorkoutMesocycle> {
  private static singletonInstance?: WorkoutMesocycleRepository;

  private constructor() {
    super(WorkoutMesocycle_docType, new WorkoutMesocycleValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const mesocycleRepo = WorkoutMesocycleRepository.getRepo();
    return {
      deleteOne: async (userId) => {
        await mesocycleRepo.deleteAllForUser(userId);
      },
      deleteList: async (userIds, meta) => {
        await mesocycleRepo.deleteAllForUsers(userIds, meta);
      }
    };
  }

  protected setupSubscribers(): void {
    this.subscribeToChanges(WorkoutMicrocycleRepository.getListenersForMesocycleRepo());
  }

  public static getRepo(): WorkoutMesocycleRepository {
    if (!WorkoutMesocycleRepository.singletonInstance) {
      WorkoutMesocycleRepository.singletonInstance = new WorkoutMesocycleRepository();
    }
    return WorkoutMesocycleRepository.singletonInstance;
  }
}
