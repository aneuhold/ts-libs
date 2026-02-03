import type { WorkoutMicrocycle } from '@aneuhold/core-ts-db-lib';
import { WorkoutMicrocycleSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
import WorkoutMesocycleRepository from '../../repositories/workout/WorkoutMesocycleRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutMicrocycleValidator extends IValidator<WorkoutMicrocycle> {
  constructor() {
    super(WorkoutMicrocycleSchema, WorkoutMicrocycleSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(newMicrocycle: WorkoutMicrocycle): Promise<void> {
    // Validate that the mesocycle exists if workoutMesocycleId is provided
    if (newMicrocycle.workoutMesocycleId) {
      const mesocycleRepo = WorkoutMesocycleRepository.getRepo();
      const mesocycle = await mesocycleRepo.get({ _id: newMicrocycle.workoutMesocycleId });
      if (!mesocycle) {
        ErrorUtils.throwError(
          `Mesocycle with ID ${newMicrocycle.workoutMesocycleId} does not exist`,
          newMicrocycle
        );
      }
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedMicrocycle: Partial<WorkoutMicrocycle>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedMicrocycle._id) {
      errors.push('No _id defined for WorkoutMicrocycle update.');
    }

    // Validate mesocycle if being updated
    if (updatedMicrocycle.workoutMesocycleId) {
      const mesocycleRepo = WorkoutMesocycleRepository.getRepo();
      const mesocycle = await mesocycleRepo.get({ _id: updatedMicrocycle.workoutMesocycleId });
      if (!mesocycle) {
        errors.push(`Mesocycle with ID ${updatedMicrocycle.workoutMesocycleId} does not exist`);
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedMicrocycle);
    }
  }

  validateRepositoryInDb(): Promise<void> {
    return Promise.resolve();
  }
}
