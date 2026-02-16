import { DateService } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';
import type { WorkoutExercise } from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutExerciseCalibration } from '../../../documents/workout/WorkoutExerciseCalibration.js';
import { CycleType, type WorkoutMesocycle } from '../../../documents/workout/WorkoutMesocycle.js';
import type { WorkoutMicrocycle } from '../../../documents/workout/WorkoutMicrocycle.js';
import { WorkoutMicrocycleSchema } from '../../../documents/workout/WorkoutMicrocycle.js';
import type { WorkoutSession } from '../../../documents/workout/WorkoutSession.js';
import type { WorkoutSessionExercise } from '../../../documents/workout/WorkoutSessionExercise.js';
import type { WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import type { DocumentOperations } from '../../DocumentService.js';
import WorkoutMicrocycleService from '../Microcycle/WorkoutMicrocycleService.js';
import WorkoutMesocyclePlanContext from './WorkoutMesocyclePlanContext.js';

/**
 * A service for handling operations related to {@link WorkoutMesocycle}s.
 */
export default class WorkoutMesocycleService {
  /**
   * Generates or updates the workout plan for a mesocycle.
   *
   * This method supports incremental generation by only creating new microcycles that don't
   * yet exist. It expects that the mesocycle's core parameters (planned session count,
   * microcycle count, microcycle length) and exercise ordering have not changed since
   * initial creation. If these parameters have changed, it is the responsibility of a
   * higher-level service to convert the mesocycle to free-form mode before calling this method.
   *
   * The method will clean up any incomplete microcycles (where the last session is not
   * complete) and regenerate from that point, unless the microcycle has already started
   * (first session complete), in which case it will throw an error.
   *
   * @param mesocycle The mesocycle configuration.
   * @param calibrations The calibration documents referenced by the mesocycle.
   * @param exercises The exercise definitions for the calibrations.
   * @param equipmentTypes The equipment types for weight increment calculations.
   * @param existingMicrocycles Existing microcycle documents for this mesocycle.
   * @param existingSessions Existing session documents.
   * @param existingSessionExercises Existing session exercise documents.
   * @param existingSets Existing set documents.
   */
  static generateOrUpdateMesocycle(
    mesocycle: WorkoutMesocycle,
    calibrations: WorkoutExerciseCalibration[],
    exercises: WorkoutExercise[],
    equipmentTypes: WorkoutEquipmentType[],
    existingMicrocycles: WorkoutMicrocycle[] = [],
    existingSessions: WorkoutSession[] = [],
    existingSessionExercises: WorkoutSessionExercise[] = [],
    existingSets: WorkoutSet[] = []
  ): {
    mesocycleUpdate?: Partial<WorkoutMesocycle>;
    microcycles?: DocumentOperations<WorkoutMicrocycle>;
    sessions?: DocumentOperations<WorkoutSession>;
    sessionExercises?: DocumentOperations<WorkoutSessionExercise>;
    sets?: DocumentOperations<WorkoutSet>;
  } {
    // Free-form mesocycles are intentionally not auto-planned. The user can still log workouts,
    // but we avoid generating microcycles/sessions/sets because recommendations wouldn't be able
    // to be done / make any sense.
    if (mesocycle.cycleType === CycleType.FreeForm) {
      return {};
    }

    // Clean up incomplete microcycles before creating context
    const cleanupResult = this.cleanUpIncompleteMicrocycles(
      mesocycle,
      existingMicrocycles,
      existingSessions,
      existingSessionExercises,
      existingSets
    );

    // Filter out documents that will be deleted
    const cleanMicrocycles = existingMicrocycles.filter(
      (m) => !cleanupResult.microcyclesToDelete.includes(m._id)
    );
    const cleanSessions = existingSessions.filter(
      (s) => !cleanupResult.sessionsToDelete.includes(s._id)
    );
    const cleanSessionExercises = existingSessionExercises.filter(
      (se) => !cleanupResult.sessionExercisesToDelete.includes(se._id)
    );
    const cleanSets = existingSets.filter((s) => !cleanupResult.setsToDelete.includes(s._id));

    // Create planning context with clean data
    const context = new WorkoutMesocyclePlanContext(
      mesocycle,
      calibrations,
      exercises,
      equipmentTypes,
      cleanMicrocycles,
      cleanSessions,
      cleanSessionExercises,
      cleanSets
    );

    // Distribute exercises across sessions once for the entire mesocycle plan.
    // This session layout is expected to be stable across microcycles.
    context.setPlannedSessionExercisePairs(
      WorkoutMicrocycleService.distributeExercisesAcrossSessions(
        mesocycle.plannedSessionCountPerMicrocycle,
        context.calibrationMap,
        context.exerciseMap
      )
    );

    // Determine number of microcycles (default to 6 if not specified: 5 accumulation + 1 deload)
    const totalMicrocycles = mesocycle.plannedMicrocycleCount ?? 6;
    const deloadMicrocycleIndex = totalMicrocycles - 1;

    // Determine starting point for generation
    const startMicrocycleIndex = context.microcyclesInOrder.length;
    let currentDate: Date;

    if (startMicrocycleIndex === 0) {
      // No existing microcycles, start from current date
      currentDate = new Date();
    } else {
      // Continue from where the last existing microcycle ended
      const lastExistingMicrocycle = context.microcyclesInOrder[startMicrocycleIndex - 1];
      currentDate = new Date(lastExistingMicrocycle.endDate);
    }

    // Generate remaining microcycles
    for (
      let microcycleIndex = startMicrocycleIndex;
      microcycleIndex < totalMicrocycles;
      microcycleIndex++
    ) {
      const isDeloadMicrocycle = microcycleIndex === deloadMicrocycleIndex;

      // Calculate RIR for this microcycle (4 -> 3 -> 2 -> 1 -> 0, capped at microcycle 5)
      const rirForMicrocycle = Math.min(microcycleIndex, 4);
      const targetRir = isDeloadMicrocycle ? null : 4 - rirForMicrocycle;

      // Create microcycle
      const microcycle = WorkoutMicrocycleSchema.parse({
        userId: mesocycle.userId,
        workoutMesocycleId: mesocycle._id,
        startDate: new Date(currentDate),
        endDate: DateService.addDays(currentDate, mesocycle.plannedMicrocycleLengthInDays)
      });
      context.addMicrocycle(microcycle);

      WorkoutMicrocycleService.generateSessionsForMicrocycle({
        context,
        microcycleIndex,
        targetRir,
        isDeloadMicrocycle
      });

      // Move to next microcycle
      currentDate = new Date(microcycle.endDate);
    }

    return {
      mesocycleUpdate: undefined,
      microcycles: {
        create: context.microcyclesToCreate,
        update: [],
        delete: cleanupResult.microcyclesToDelete
      },
      sessions: {
        create: context.sessionsToCreate,
        update: [],
        delete: cleanupResult.sessionsToDelete
      },
      sessionExercises: {
        create: context.sessionExercisesToCreate,
        update: [],
        delete: cleanupResult.sessionExercisesToDelete
      },
      sets: { create: context.setsToCreate, update: [], delete: cleanupResult.setsToDelete }
    };
  }

  /**
   * Cleans up incomplete microcycles and their associated documents.
   *
   * Finds the first microcycle where the last session is not complete, validates that it
   * hasn't started (first session incomplete), and returns IDs of all documents that should
   * be deleted (microcycles from that point forward and all their associated data).
   */
  private static cleanUpIncompleteMicrocycles(
    mesocycle: WorkoutMesocycle,
    existingMicrocycles: WorkoutMicrocycle[],
    existingSessions: WorkoutSession[],
    existingSessionExercises: WorkoutSessionExercise[],
    existingSets: WorkoutSet[]
  ): {
    microcyclesToDelete: UUID[];
    sessionsToDelete: UUID[];
    sessionExercisesToDelete: UUID[];
    setsToDelete: UUID[];
  } {
    const microcyclesToDelete: UUID[] = [];
    const sessionsToDelete: UUID[] = [];
    const sessionExercisesToDelete: UUID[] = [];
    const setsToDelete: UUID[] = [];

    // Sort microcycles for this mesocycle
    const microcyclesForMesocycle = existingMicrocycles.sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    );

    // Find first incomplete microcycle
    let firstIncompleteMicrocycleIndex = -1;
    for (let i = 0; i < microcyclesForMesocycle.length; i++) {
      const microcycle = microcyclesForMesocycle[i];
      if (microcycle.sessionOrder.length === 0) {
        // Microcycle has no sessions, it's incomplete
        firstIncompleteMicrocycleIndex = i;
        break;
      }

      // Check if last session is complete
      const lastSessionId = microcycle.sessionOrder[microcycle.sessionOrder.length - 1];
      const lastSession = existingSessions.find((s) => s._id === lastSessionId);
      if (!lastSession?.complete) {
        firstIncompleteMicrocycleIndex = i;
        break;
      }
    }

    // If all microcycles are complete, nothing to clean up
    if (firstIncompleteMicrocycleIndex === -1) {
      return { microcyclesToDelete, sessionsToDelete, sessionExercisesToDelete, setsToDelete };
    }

    const firstIncompleteMicrocycle = microcyclesForMesocycle[firstIncompleteMicrocycleIndex];

    // Check if the incomplete microcycle has started (first session complete)
    if (firstIncompleteMicrocycle.sessionOrder.length > 0) {
      const firstSessionId = firstIncompleteMicrocycle.sessionOrder[0];
      const firstSession = existingSessions.find((s) => s._id === firstSessionId);
      if (firstSession?.complete) {
        throw new Error(
          `Cannot generate new microcycles for mesocycle ${mesocycle._id}: ` +
            `Microcycle at index ${firstIncompleteMicrocycleIndex} has started but is not complete. ` +
            `All sessions in the current microcycle must be completed before generating new microcycles.`
        );
      }
    }

    // Collect IDs of incomplete microcycles (from firstIncompleteMicrocycleIndex onward)
    const incompleteMicrocycles = microcyclesForMesocycle.slice(firstIncompleteMicrocycleIndex);
    microcyclesToDelete.push(...incompleteMicrocycles.map((m) => m._id));

    // Collect all sessions, session exercises, and sets associated with incomplete microcycles
    const incompleteMicrocycleIds = new Set(incompleteMicrocycles.map((m) => m._id));
    for (const session of existingSessions) {
      if (session.workoutMicrocycleId && incompleteMicrocycleIds.has(session.workoutMicrocycleId)) {
        sessionsToDelete.push(session._id);
      }
    }

    const sessionIdsToDelete = new Set(sessionsToDelete);
    for (const sessionExercise of existingSessionExercises) {
      if (sessionIdsToDelete.has(sessionExercise.workoutSessionId)) {
        sessionExercisesToDelete.push(sessionExercise._id);
      }
    }

    const sessionExerciseIdsToDelete = new Set(sessionExercisesToDelete);
    for (const set of existingSets) {
      if (sessionExerciseIdsToDelete.has(set.workoutSessionExerciseId)) {
        setsToDelete.push(set._id);
      }
    }

    return { microcyclesToDelete, sessionsToDelete, sessionExercisesToDelete, setsToDelete };
  }
}
