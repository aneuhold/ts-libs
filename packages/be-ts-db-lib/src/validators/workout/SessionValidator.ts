import type { WorkoutSession } from '@aneuhold/core-ts-db-lib';
import { WorkoutSessionSchema } from '@aneuhold/core-ts-db-lib';
import { DR, ErrorUtils } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import UserRepository from '../../repositories/common/UserRepository.js';
import WorkoutMicrocycleRepository from '../../repositories/workout/WorkoutMicrocycleRepository.js';
import WorkoutSessionRepository from '../../repositories/workout/WorkoutSessionRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutSessionValidator extends IValidator<WorkoutSession> {
  constructor() {
    super(WorkoutSessionSchema, WorkoutSessionSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(newSession: WorkoutSession): Promise<void> {
    // Validate that the microcycle exists if workoutMicrocycleId is provided
    if (newSession.workoutMicrocycleId) {
      const microcycleRepo = WorkoutMicrocycleRepository.getRepo();
      const microcycle = await microcycleRepo.get({ _id: newSession.workoutMicrocycleId });
      if (!microcycle) {
        ErrorUtils.throwError(
          `Microcycle with ID ${newSession.workoutMicrocycleId} does not exist`,
          newSession
        );
      }
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedSession: Partial<WorkoutSession>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedSession._id) {
      errors.push('No _id defined for WorkoutSession update.');
    }

    // Validate microcycle if being updated
    if (updatedSession.workoutMicrocycleId) {
      const microcycleRepo = WorkoutMicrocycleRepository.getRepo();
      const microcycle = await microcycleRepo.get({ _id: updatedSession.workoutMicrocycleId });
      if (!microcycle) {
        errors.push(`Microcycle with ID ${updatedSession.workoutMicrocycleId} does not exist`);
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedSession);
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const sessionRepo = WorkoutSessionRepository.getRepo();
    const allSessions = await sessionRepo.getAll();
    const allUserIds = await UserRepository.getRepo().getAllIdsAsHash();
    const allMicrocycleIds = await WorkoutMicrocycleRepository.getRepo().getAllIdsAsHash();

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'Workout Session',
      allDocs: allSessions,
      shouldDelete: (session: WorkoutSession) => {
        if (!allUserIds[session.userId]) {
          DR.logger.error(`Workout Session with ID: ${session._id} has no valid associated user.`);
          return true;
        }
        return false;
      },
      additionalValidation: (session: WorkoutSession) => {
        const updatedDoc = { ...session };
        const errors: string[] = [];

        // Check microcycle if it exists
        if (session.workoutMicrocycleId && !allMicrocycleIds[session.workoutMicrocycleId]) {
          errors.push(`Microcycle with ID: ${session.workoutMicrocycleId} does not exist.`);
          updatedDoc.workoutMicrocycleId = null;
        }

        return { updatedDoc, errors };
      },
      deletionFunction: async (docIdsToDelete: UUID[]) => {
        await sessionRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: WorkoutSession[]) => {
        await sessionRepo.updateMany(docsToUpdate);
      }
    });
  }
}
