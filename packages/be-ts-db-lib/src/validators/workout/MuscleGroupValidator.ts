import type { WorkoutMuscleGroup } from '@aneuhold/core-ts-db-lib';
import { WorkoutMuscleGroupSchema } from '@aneuhold/core-ts-db-lib';
import { DR, ErrorUtils } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import UserRepository from '../../repositories/common/UserRepository.js';
import WorkoutMuscleGroupRepository from '../../repositories/workout/WorkoutMuscleGroupRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutMuscleGroupValidator extends IValidator<WorkoutMuscleGroup> {
  constructor() {
    super(WorkoutMuscleGroupSchema, WorkoutMuscleGroupSchema.partial());
  }

  protected validateNewObjectBusinessLogic(): Promise<void> {
    return Promise.resolve();
  }

  protected validateUpdateObjectBusinessLogic(
    updatedMuscleGroup: Partial<WorkoutMuscleGroup>
  ): Promise<void> {
    if (!updatedMuscleGroup._id) {
      ErrorUtils.throwError('No _id defined for WorkoutMuscleGroup update.', updatedMuscleGroup);
    }
    return Promise.resolve();
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const muscleGroupRepo = WorkoutMuscleGroupRepository.getRepo();
    const allMuscleGroups = await muscleGroupRepo.getAll();
    const allUserIds = await UserRepository.getRepo().getAllIdsAsHash();

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'Workout Muscle Group',
      allDocs: allMuscleGroups,
      shouldDelete: (muscleGroup: WorkoutMuscleGroup) => {
        if (!allUserIds[muscleGroup.userId]) {
          DR.logger.error(
            `Workout Muscle Group with ID: ${muscleGroup._id} has no valid associated user.`
          );
          return true;
        }
        return false;
      },
      deletionFunction: async (docIdsToDelete: UUID[]) => {
        await muscleGroupRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: WorkoutMuscleGroup[]) => {
        await muscleGroupRepo.updateMany(docsToUpdate);
      }
    });
  }
}
