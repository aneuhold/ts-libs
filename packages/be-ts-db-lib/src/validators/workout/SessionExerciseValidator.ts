import type { WorkoutSessionExercise } from '@aneuhold/core-ts-db-lib';
import { WorkoutSessionExerciseSchema } from '@aneuhold/core-ts-db-lib';
import { DR, ErrorUtils } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import UserRepository from '../../repositories/common/UserRepository.js';
import WorkoutExerciseRepository from '../../repositories/workout/WorkoutExerciseRepository.js';
import WorkoutSessionExerciseRepository from '../../repositories/workout/WorkoutSessionExerciseRepository.js';
import WorkoutSessionRepository from '../../repositories/workout/WorkoutSessionRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutSessionExerciseValidator extends IValidator<WorkoutSessionExercise> {
  constructor() {
    super(WorkoutSessionExerciseSchema, WorkoutSessionExerciseSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(
    newSessionExercise: WorkoutSessionExercise
  ): Promise<void> {
    const errors: string[] = [];

    // Validate that the session exists
    const sessionRepo = WorkoutSessionRepository.getRepo();
    const session = await sessionRepo.get({ _id: newSessionExercise.workoutSessionId });
    if (!session) {
      errors.push(`Session with ID ${newSessionExercise.workoutSessionId} does not exist`);
    }

    // Validate that the exercise exists
    const exerciseRepo = WorkoutExerciseRepository.getRepo();
    const exercise = await exerciseRepo.get({ _id: newSessionExercise.workoutExerciseId });
    if (!exercise) {
      errors.push(`Exercise with ID ${newSessionExercise.workoutExerciseId} does not exist`);
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, newSessionExercise);
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedSessionExercise: Partial<WorkoutSessionExercise>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedSessionExercise._id) {
      errors.push('No _id defined for WorkoutSessionExercise update.');
    }

    // Validate session if being updated
    if (updatedSessionExercise.workoutSessionId) {
      const sessionRepo = WorkoutSessionRepository.getRepo();
      const session = await sessionRepo.get({ _id: updatedSessionExercise.workoutSessionId });
      if (!session) {
        errors.push(`Session with ID ${updatedSessionExercise.workoutSessionId} does not exist`);
      }
    }

    // Validate exercise if being updated
    if (updatedSessionExercise.workoutExerciseId) {
      const exerciseRepo = WorkoutExerciseRepository.getRepo();
      const exercise = await exerciseRepo.get({ _id: updatedSessionExercise.workoutExerciseId });
      if (!exercise) {
        errors.push(`Exercise with ID ${updatedSessionExercise.workoutExerciseId} does not exist`);
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedSessionExercise);
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const sessionExerciseRepo = WorkoutSessionExerciseRepository.getRepo();
    const allSessionExercises = await sessionExerciseRepo.getAll();
    const allUserIds = await UserRepository.getRepo().getAllIdsAsHash();
    const allSessionIds = await WorkoutSessionRepository.getRepo().getAllIdsAsHash();
    const allExerciseIds = await WorkoutExerciseRepository.getRepo().getAllIdsAsHash();

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'Workout Session Exercise',
      allDocs: allSessionExercises,
      shouldDelete: (sessionExercise: WorkoutSessionExercise) => {
        if (!allUserIds[sessionExercise.userId]) {
          DR.logger.error(
            `Workout Session Exercise with ID: ${sessionExercise._id} has no valid associated user.`
          );
          return true;
        }
        if (!allSessionIds[sessionExercise.workoutSessionId]) {
          DR.logger.error(
            `Workout Session Exercise with ID: ${sessionExercise._id} has no valid associated session.`
          );
          return true;
        }
        return false;
      },
      additionalValidation: (sessionExercise: WorkoutSessionExercise) => {
        const updatedDoc = { ...sessionExercise };
        const errors: string[] = [];

        // Check exercise
        if (!allExerciseIds[sessionExercise.workoutExerciseId]) {
          errors.push(`Exercise with ID: ${sessionExercise.workoutExerciseId} does not exist.`);
        }

        return { updatedDoc, errors };
      },
      deletionFunction: async (docIdsToDelete: UUID[]) => {
        await sessionExerciseRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: WorkoutSessionExercise[]) => {
        await sessionExerciseRepo.updateMany(docsToUpdate);
      }
    });
  }
}
