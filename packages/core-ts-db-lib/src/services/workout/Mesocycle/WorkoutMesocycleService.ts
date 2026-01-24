import { DateService } from '@aneuhold/core-ts-lib';
import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';
import type { WorkoutExercise } from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutExerciseCalibration } from '../../../documents/workout/WorkoutExerciseCalibration.js';
import type { WorkoutMesocycle } from '../../../documents/workout/WorkoutMesocycle.js';
import type { WorkoutMicrocycle } from '../../../documents/workout/WorkoutMicrocycle.js';
import { WorkoutMicrocycleSchema } from '../../../documents/workout/WorkoutMicrocycle.js';
import type { WorkoutSession } from '../../../documents/workout/WorkoutSession.js';
import type { WorkoutSessionExercise } from '../../../documents/workout/WorkoutSessionExercise.js';
import type { WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import type { DocumentOperations } from '../../DocumentService.js';
import WorkoutMicrocycleService from '../Microcycle/WorkoutMicrocycleService.js';

/**
 * A service for handling operations related to {@link WorkoutMesocycle}s.
 */
export default class WorkoutMesocycleService {
  /**
   * Generates the complete initial workout plan for an entire mesocycle.
   *
   * @param mesocycle The mesocycle configuration.
   * @param calibrations The calibration documents referenced by the mesocycle.
   * @param exercises The exercise definitions for the calibrations.
   * @param equipmentTypes The equipment types for weight increment calculations.
   */
  static generateInitialPlan(
    mesocycle: WorkoutMesocycle,
    calibrations: WorkoutExerciseCalibration[],
    exercises: WorkoutExercise[],
    equipmentTypes: WorkoutEquipmentType[]
  ): {
    mesocycleUpdate?: Partial<WorkoutMesocycle>;
    microcycles?: DocumentOperations<WorkoutMicrocycle>;
    sessions?: DocumentOperations<WorkoutSession>;
    sessionExercises?: DocumentOperations<WorkoutSessionExercise>;
    sets?: DocumentOperations<WorkoutSet>;
  } {
    const microcyclesToCreate: WorkoutMicrocycle[] = [];
    const sessionsToCreate: WorkoutSession[] = [];
    const sessionExercisesToCreate: WorkoutSessionExercise[] = [];
    const setsToCreate: WorkoutSet[] = [];

    // Create lookup maps
    const calibrationMap = new Map(calibrations.map((c) => [c._id, c]));
    const exerciseMap = new Map(exercises.map((e) => [e._id, e]));
    const equipmentMap = new Map(equipmentTypes.map((et) => [et._id, et]));

    // Determine number of microcycles (default to 6 if not specified: 5 accumulation + 1 deload)
    const totalMicrocycles = mesocycle.plannedMicrocycleCount ?? 6;
    const deloadMicrocycleIndex = totalMicrocycles - 1;

    // First microcycle RIR is always 4 (used for weight calculations)
    const firstMicrocycleRir = 4;

    // Set start date to the current date initially
    let currentDate = new Date();

    // Generate each microcycle
    for (let microcycleIndex = 0; microcycleIndex < totalMicrocycles; microcycleIndex++) {
      const isDeloadMicrocycle = microcycleIndex === deloadMicrocycleIndex;

      // Calculate RIR for this microcycle (4 -> 3 -> 2 -> 1 -> 0, capped at microcycle 5)
      const rirForMicrocycle = Math.min(microcycleIndex, 4);
      const targetRir = 4 - rirForMicrocycle;

      // Create microcycle
      const microcycle = WorkoutMicrocycleSchema.parse({
        userId: mesocycle.userId,
        workoutMesocycleId: mesocycle._id,
        startDate: new Date(currentDate),
        endDate: DateService.addDays(currentDate, mesocycle.plannedMicrocycleLengthInDays)
      });
      microcyclesToCreate.push(microcycle);

      // Generate sessions for this microcycle
      const sessions = WorkoutMicrocycleService.generateSessionsForMicrocycle(
        mesocycle,
        microcycle,
        microcycleIndex,
        targetRir,
        firstMicrocycleRir,
        isDeloadMicrocycle,
        calibrationMap,
        exerciseMap,
        equipmentMap
      );

      sessionsToCreate.push(...sessions.sessions);
      sessionExercisesToCreate.push(...sessions.sessionExercises);
      setsToCreate.push(...sessions.sets);

      // Move to next microcycle
      currentDate = new Date(microcycle.endDate);
    }

    return {
      mesocycleUpdate: undefined,
      microcycles: { create: microcyclesToCreate, update: [], delete: [] },
      sessions: { create: sessionsToCreate, update: [], delete: [] },
      sessionExercises: { create: sessionExercisesToCreate, update: [], delete: [] },
      sets: { create: setsToCreate, update: [], delete: [] }
    };
  }
}
