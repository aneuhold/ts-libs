import type { WorkoutExerciseCalibration } from '@aneuhold/core-ts-db-lib';
import { WorkoutExerciseCalibrationSchema } from '@aneuhold/core-ts-db-lib';
import { DR, ErrorUtils } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import UserRepository from '../../repositories/common/UserRepository.js';
import WorkoutExerciseCalibrationRepository from '../../repositories/workout/WorkoutExerciseCalibrationRepository.js';
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

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const calibrationRepo = WorkoutExerciseCalibrationRepository.getRepo();
    const allCalibrations = await calibrationRepo.getAll();
    const allUserIds = await UserRepository.getRepo().getAllIdsAsHash();
    const allExerciseIds = await WorkoutExerciseRepository.getRepo().getAllIdsAsHash();

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'Workout Exercise Calibration',
      allDocs: allCalibrations,
      shouldDelete: (calibration: WorkoutExerciseCalibration) => {
        if (!allUserIds[calibration.userId]) {
          DR.logger.error(
            `Workout Exercise Calibration with ID: ${calibration._id} has no valid associated user.`
          );
          return true;
        }
        if (!allExerciseIds[calibration.workoutExerciseId]) {
          DR.logger.error(
            `Workout Exercise Calibration with ID: ${calibration._id} has no valid associated exercise.`
          );
          return true;
        }
        return false;
      },
      deletionFunction: async (docIdsToDelete: UUID[]) => {
        await calibrationRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: WorkoutExerciseCalibration[]) => {
        await calibrationRepo.updateMany(docsToUpdate);
      }
    });
  }
}
