import type { WorkoutMesocycle } from '@aneuhold/core-ts-db-lib';
import { WorkoutMesocycleSchema } from '@aneuhold/core-ts-db-lib';
import { DR, ErrorUtils } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import UserRepository from '../../repositories/common/UserRepository.js';
import WorkoutExerciseCalibrationRepository from '../../repositories/workout/WorkoutExerciseCalibrationRepository.js';
import WorkoutMesocycleRepository from '../../repositories/workout/WorkoutMesocycleRepository.js';
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

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const mesocycleRepo = WorkoutMesocycleRepository.getRepo();
    const allMesocycles = await mesocycleRepo.getAll();
    const allUserIds = await UserRepository.getRepo().getAllIdsAsHash();
    const allCalibrationIds =
      await WorkoutExerciseCalibrationRepository.getRepo().getAllIdsAsHash();

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'Workout Mesocycle',
      allDocs: allMesocycles,
      shouldDelete: (mesocycle: WorkoutMesocycle) => {
        if (!allUserIds[mesocycle.userId]) {
          DR.logger.error(
            `Workout Mesocycle with ID: ${mesocycle._id} has no valid associated user.`
          );
          return true;
        }
        return false;
      },
      additionalValidation: (mesocycle: WorkoutMesocycle) => {
        const updatedDoc = { ...mesocycle };
        const errors: string[] = [];

        // Check calibrated exercises
        const invalidCalibrations = mesocycle.calibratedExercises.filter(
          (id) => !allCalibrationIds[id]
        );
        if (invalidCalibrations.length > 0) {
          errors.push(`Invalid calibrated exercises: ${invalidCalibrations.join(', ')}`);
          updatedDoc.calibratedExercises = mesocycle.calibratedExercises.filter(
            (id) => allCalibrationIds[id]
          );
        }

        return { updatedDoc, errors };
      },
      deletionFunction: async (docIdsToDelete: UUID[]) => {
        await mesocycleRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: WorkoutMesocycle[]) => {
        await mesocycleRepo.updateMany(docsToUpdate);
      }
    });
  }
}
