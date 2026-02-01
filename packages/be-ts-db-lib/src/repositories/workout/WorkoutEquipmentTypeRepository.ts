import type { WorkoutEquipmentType } from '@aneuhold/core-ts-db-lib';
import { WorkoutEquipmentType_docType } from '@aneuhold/core-ts-db-lib';
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
