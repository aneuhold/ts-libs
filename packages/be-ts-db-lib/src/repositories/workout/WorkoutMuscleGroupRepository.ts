import type { WorkoutMuscleGroup } from '@aneuhold/core-ts-db-lib';
import { WorkoutMuscleGroup_docType } from '@aneuhold/core-ts-db-lib';
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
