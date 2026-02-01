import type { WorkoutExerciseCalibration } from '@aneuhold/core-ts-db-lib';
import { WorkoutExerciseCalibrationSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
import WorkoutExerciseRepository from '../../repositories/workout/WorkoutExerciseRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutExerciseCalibrationValidator extends IValidator<WorkoutExerciseCalibration> {
  constructor() {
    super(WorkoutExerciseCalibrationSchema, WorkoutExerciseCalibrationSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(
    newCalibration: WorkoutExerciseCalibration
  ): Promise<void> {
    // Validate that the exercise exists
    const exerciseRepo = WorkoutExerciseRepository.getRepo();
    const exercise = await exerciseRepo.get({ _id: newCalibration.workoutExerciseId });
    if (!exercise) {
      ErrorUtils.throwError(
        `Exercise with ID ${newCalibration.workoutExerciseId} does not exist`,
        newCalibration
      );
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedCalibration: Partial<WorkoutExerciseCalibration>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedCalibration._id) {
      errors.push('No _id defined for WorkoutExerciseCalibration update.');
    }

    // Validate exercise if being updated
    if (updatedCalibration.workoutExerciseId) {
      const exerciseRepo = WorkoutExerciseRepository.getRepo();
      const exercise = await exerciseRepo.get({ _id: updatedCalibration.workoutExerciseId });
      if (!exercise) {
        errors.push(`Exercise with ID ${updatedCalibration.workoutExerciseId} does not exist`);
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedCalibration);
    }
  }

  validateRepositoryInDb(): Promise<void> {
    return Promise.resolve();
  }
}
