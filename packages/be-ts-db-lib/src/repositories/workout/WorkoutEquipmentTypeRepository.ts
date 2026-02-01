import type { User, WorkoutEquipmentType } from '@aneuhold/core-ts-db-lib';
import { WorkoutEquipmentType_docType } from '@aneuhold/core-ts-db-lib';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import WorkoutEquipmentTypeValidator from '../../validators/workout/EquipmentTypeValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link WorkoutEquipmentType} documents.
 */
export default class WorkoutEquipmentTypeRepository extends WorkoutBaseWithUserIdRepository<WorkoutEquipmentType> {
  private static singletonInstance?: WorkoutEquipmentTypeRepository;

  private constructor() {
    super(WorkoutEquipmentType_docType, new WorkoutEquipmentTypeValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const equipmentTypeRepo = WorkoutEquipmentTypeRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await (
          await equipmentTypeRepo.getCollection()
        ).deleteMany({
          userId,
          docType: WorkoutEquipmentType_docType
        });
        meta?.recordDocTypeTouched(WorkoutEquipmentType_docType);
        meta?.addAffectedUserIds([userId]);
      },
      deleteList: async (userIds, meta) => {
        await (
          await equipmentTypeRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds },
          docType: WorkoutEquipmentType_docType
        });
        meta?.recordDocTypeTouched(WorkoutEquipmentType_docType);
        meta?.addAffectedUserIds(userIds);
      }
    };
  }

  protected setupSubscribers(): void {}

  /**
   * Gets the singleton instance of the {@link WorkoutEquipmentTypeRepository}.
   */
  public static getRepo(): WorkoutEquipmentTypeRepository {
    if (!WorkoutEquipmentTypeRepository.singletonInstance) {
      WorkoutEquipmentTypeRepository.singletonInstance = new WorkoutEquipmentTypeRepository();
    }
    return WorkoutEquipmentTypeRepository.singletonInstance;
  }
}
