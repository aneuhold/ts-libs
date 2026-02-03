import type { WorkoutMesocycle } from '@aneuhold/core-ts-db-lib';
import { WorkoutMesocycleSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
import IValidator from '../BaseValidator.js';

export default class WorkoutMesocycleValidator extends IValidator<WorkoutMesocycle> {
  constructor() {
    super(WorkoutMesocycleSchema, WorkoutMesocycleSchema.partial());
  }

  protected validateNewObjectBusinessLogic(): Promise<void> {
    return Promise.resolve();
  }

  protected validateUpdateObjectBusinessLogic(
    updatedMesocycle: Partial<WorkoutMesocycle>
  ): Promise<void> {
    if (!updatedMesocycle._id) {
      ErrorUtils.throwError('No _id defined for WorkoutMesocycle update.', updatedMesocycle);
    }
    return Promise.resolve();
  }

  validateRepositoryInDb(): Promise<void> {
    return Promise.resolve();
  }
}
