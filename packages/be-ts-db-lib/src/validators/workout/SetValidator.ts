import type { WorkoutSet } from '@aneuhold/core-ts-db-lib';
import { WorkoutSetSchema } from '@aneuhold/core-ts-db-lib';
import { DR, ErrorUtils } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import UserRepository from '../../repositories/common/UserRepository.js';
import WorkoutSessionExerciseRepository from '../../repositories/workout/WorkoutSessionExerciseRepository.js';
import WorkoutSetRepository from '../../repositories/workout/WorkoutSetRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutSetValidator extends IValidator<WorkoutSet> {
  constructor() {
    super(WorkoutSetSchema, WorkoutSetSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(newSet: WorkoutSet): Promise<void> {
    // Validate that the session exercise exists
    const sessionExerciseRepo = WorkoutSessionExerciseRepository.getRepo();
    const sessionExercise = await sessionExerciseRepo.get({
      _id: newSet.workoutSessionExerciseId
    });
    if (!sessionExercise) {
      ErrorUtils.throwError(
        `Session exercise with ID ${newSet.workoutSessionExerciseId} does not exist`,
        newSet
      );
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedSet: Partial<WorkoutSet>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedSet._id) {
      errors.push('No _id defined for WorkoutSet update.');
    }

    // Validate session exercise if being updated
    if (updatedSet.workoutSessionExerciseId) {
      const sessionExerciseRepo = WorkoutSessionExerciseRepository.getRepo();
      const sessionExercise = await sessionExerciseRepo.get({
        _id: updatedSet.workoutSessionExerciseId
      });
      if (!sessionExercise) {
        errors.push(
          `Session exercise with ID ${updatedSet.workoutSessionExerciseId} does not exist`
        );
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedSet);
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const setRepo = WorkoutSetRepository.getRepo();
    const allSets = await setRepo.getAll();
    const allUserIds = await UserRepository.getRepo().getAllIdsAsHash();
    const allSessionExerciseIds =
      await WorkoutSessionExerciseRepository.getRepo().getAllIdsAsHash();

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'Workout Set',
      allDocs: allSets,
      shouldDelete: (set: WorkoutSet) => {
        if (!allUserIds[set.userId]) {
          DR.logger.error(`Workout Set with ID: ${set._id} has no valid associated user.`);
          return true;
        }
        if (!allSessionExerciseIds[set.workoutSessionExerciseId]) {
          DR.logger.error(
            `Workout Set with ID: ${set._id} has no valid associated session exercise.`
          );
          return true;
        }
        return false;
      },
      deletionFunction: async (docIdsToDelete: UUID[]) => {
        await setRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: WorkoutSet[]) => {
        await setRepo.updateMany(docsToUpdate);
      }
    });
  }
}
