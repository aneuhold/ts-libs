import type { WorkoutMicrocycle } from '@aneuhold/core-ts-db-lib';
import { WorkoutMicrocycleSchema } from '@aneuhold/core-ts-db-lib';
import { DR, ErrorUtils } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import UserRepository from '../../repositories/common/UserRepository.js';
import WorkoutMesocycleRepository from '../../repositories/workout/WorkoutMesocycleRepository.js';
import WorkoutMicrocycleRepository from '../../repositories/workout/WorkoutMicrocycleRepository.js';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutMicrocycleValidator extends IValidator<WorkoutMicrocycle> {
  constructor() {
    super(WorkoutMicrocycleSchema, WorkoutMicrocycleSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(
    newMicrocycle: WorkoutMicrocycle,
    meta?: DbOperationMetaData
  ): Promise<void> {
    // Validate that the mesocycle exists if workoutMesocycleId is provided
    if (newMicrocycle.workoutMesocycleId) {
      const isPendingMesocycle = meta?.hasPendingDoc(newMicrocycle.workoutMesocycleId);

      if (!isPendingMesocycle) {
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
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedMicrocycle: Partial<WorkoutMicrocycle>,
    meta?: DbOperationMetaData
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedMicrocycle._id) {
      errors.push('No _id defined for WorkoutMicrocycle update.');
    }

    // Validate mesocycle if being updated
    if (updatedMicrocycle.workoutMesocycleId) {
      const isPendingMesocycle = meta?.hasPendingDoc(updatedMicrocycle.workoutMesocycleId);

      if (!isPendingMesocycle) {
        const mesocycleRepo = WorkoutMesocycleRepository.getRepo();
        const mesocycle = await mesocycleRepo.get({ _id: updatedMicrocycle.workoutMesocycleId });
        if (!mesocycle) {
          errors.push(`Mesocycle with ID ${updatedMicrocycle.workoutMesocycleId} does not exist`);
        }
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedMicrocycle);
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const microcycleRepo = WorkoutMicrocycleRepository.getRepo();
    const allMicrocycles = await microcycleRepo.getAll();
    const allUserIds = await UserRepository.getRepo().getAllIdsAsHash();
    const allMesocycleIds = await WorkoutMesocycleRepository.getRepo().getAllIdsAsHash();

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'Workout Microcycle',
      allDocs: allMicrocycles,
      shouldDelete: (microcycle: WorkoutMicrocycle) => {
        if (!allUserIds[microcycle.userId]) {
          DR.logger.error(
            `Workout Microcycle with ID: ${microcycle._id} has no valid associated user.`
          );
          return true;
        }
        return false;
      },
      additionalValidation: (microcycle: WorkoutMicrocycle) => {
        const updatedDoc = { ...microcycle };
        const errors: string[] = [];

        // Check mesocycle if it exists
        if (microcycle.workoutMesocycleId && !allMesocycleIds[microcycle.workoutMesocycleId]) {
          errors.push(`Mesocycle with ID: ${microcycle.workoutMesocycleId} does not exist.`);
          updatedDoc.workoutMesocycleId = null;
        }

        return { updatedDoc, errors };
      },
      deletionFunction: async (docIdsToDelete: UUID[]) => {
        await microcycleRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: WorkoutMicrocycle[]) => {
        await microcycleRepo.updateMany(docsToUpdate);
      }
    });
  }
}
