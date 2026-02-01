import type { User, WorkoutMuscleGroup } from '@aneuhold/core-ts-db-lib';
import { WorkoutMuscleGroup_docType } from '@aneuhold/core-ts-db-lib';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import WorkoutMuscleGroupValidator from '../../validators/workout/MuscleGroupValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link WorkoutMuscleGroup} documents.
 */
export default class WorkoutMuscleGroupRepository extends WorkoutBaseWithUserIdRepository<WorkoutMuscleGroup> {
  private static singletonInstance?: WorkoutMuscleGroupRepository;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    super(WorkoutMuscleGroup_docType, new WorkoutMuscleGroupValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const muscleGroupRepo = WorkoutMuscleGroupRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await (
          await muscleGroupRepo.getCollection()
        ).deleteMany({
          userId,
          docType: WorkoutMuscleGroup_docType
        });
        meta?.recordDocTypeTouched(WorkoutMuscleGroup_docType);
        meta?.addAffectedUserIds([userId]);
      },
      deleteList: async (userIds, meta) => {
        await (
          await muscleGroupRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds },
          docType: WorkoutMuscleGroup_docType
        });
        meta?.recordDocTypeTouched(WorkoutMuscleGroup_docType);
        meta?.addAffectedUserIds(userIds);
      }
    };
  }

  protected setupSubscribers(): void {}

  /**
   * Gets the singleton instance of the {@link WorkoutMuscleGroupRepository}.
   */
  public static getRepo(): WorkoutMuscleGroupRepository {
    if (!WorkoutMuscleGroupRepository.singletonInstance) {
      WorkoutMuscleGroupRepository.singletonInstance = new WorkoutMuscleGroupRepository();
    }
    return WorkoutMuscleGroupRepository.singletonInstance;
  }
}
