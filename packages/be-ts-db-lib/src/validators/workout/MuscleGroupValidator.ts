import type { WorkoutMuscleGroup } from '@aneuhold/core-ts-db-lib';
import { WorkoutMuscleGroupSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
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

  validateRepositoryInDb(): Promise<void> {
    // Repository validation can be implemented later if needed
    return Promise.resolve();
  }
}
