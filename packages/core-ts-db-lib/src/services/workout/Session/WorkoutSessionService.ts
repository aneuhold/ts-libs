import type { CalibrationExercisePair } from '../../../documents/workout/WorkoutExerciseCalibration.js';
import type { WorkoutSession } from '../../../documents/workout/WorkoutSession.js';
import { WorkoutSessionSchema } from '../../../documents/workout/WorkoutSession.js';
import { WorkoutSessionExerciseSchema } from '../../../documents/workout/WorkoutSessionExercise.js';
import type WorkoutMesocyclePlanContext from '../Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutSetService from '../Set/WorkoutSetService.js';
import WorkoutSFRService from '../util/SFR/WorkoutSFRService.js';

/**
 * A service for handling operations related to {@link WorkoutSession}s.
 */
export default class WorkoutSessionService {
  /**
   * Calculates the total Raw Stimulus Magnitude for a session.
   *
   * @param session The workout session.
   */
  static getRsmTotal(session: WorkoutSession): number | null {
    return WorkoutSFRService.getRsmTotal(session.rsm);
  }

  /**
   * Calculates the total fatigue score for a session.
   *
   * @param session The workout session.
   */
  static getFatigueTotal(session: WorkoutSession): number | null {
    return WorkoutSFRService.getFatigueTotal(session.fatigue);
  }

  /**
   * Calculates the Stimulus to Fatigue Ratio (SFR) for a session.
   *
   * @param session The workout session.
   */
  static getSFR(session: WorkoutSession): number | null {
    return WorkoutSFRService.getSFR(session.rsm, session.fatigue);
  }

  /**
   * Generates a session and its associated exercises and sets.
   */
  static generateSession({
    context,
    microcycleIndex,
    sessionIndex,
    sessionStartDate,
    sessionExerciseList,
    targetRir,
    isDeloadMicrocycle
  }: {
    context: WorkoutMesocyclePlanContext;
    microcycleIndex: number;
    sessionIndex: number;
    sessionStartDate: Date;
    sessionExerciseList: CalibrationExercisePair[];
    targetRir: number;
    isDeloadMicrocycle: boolean;
  }): void {
    const mesocycle = context.mesocycle;
    const microcycle = context.microcyclesToCreate[microcycleIndex];

    // Create session
    const session = WorkoutSessionSchema.parse({
      userId: mesocycle.userId,
      workoutMicrocycleId: microcycle._id,
      title: `Microcycle ${microcycleIndex + 1} - Session ${sessionIndex + 1}`,
      startTime: sessionStartDate
    });

    // Create session exercise groupings and associated sets
    for (let exerciseIndex = 0; exerciseIndex < sessionExerciseList.length; exerciseIndex++) {
      const { calibration, exercise } = sessionExerciseList[exerciseIndex];

      // Calculate number of sets for this exercise in this microcycle
      const setCount = this.calculateSetCount(
        microcycleIndex,
        sessionExerciseList.length,
        exerciseIndex,
        isDeloadMicrocycle
      );

      // Get equipment for weight calculations
      const equipment = context.equipmentMap.get(exercise.workoutEquipmentTypeId);
      if (!equipment) {
        throw new Error(
          `Equipment type not found for exercise ${exercise._id}, ${exercise.exerciseName}`
        );
      }
      if (!equipment.weightOptions || equipment.weightOptions.length === 0) {
        throw new Error(
          `No weight options defined for equipment type ${equipment._id}, ${equipment.title}`
        );
      }

      const sessionExercise = WorkoutSessionExerciseSchema.parse({
        userId: mesocycle.userId,
        workoutSessionId: session._id,
        workoutExerciseId: exercise._id
      });

      WorkoutSetService.generateSetsForSessionExercise({
        context,
        exercise,
        calibration,
        session,
        sessionExercise,
        microcycleIndex,
        sessionIndex,
        setCount,
        targetRir,
        isDeloadMicrocycle
      });

      const setsForThisExercise = context.setsToCreate.slice(-setCount);

      sessionExercise.setOrder.push(...setsForThisExercise.map((s) => s._id));
      session.sessionExerciseOrder.push(sessionExercise._id);
      context.sessionExercisesToCreate.push(sessionExercise);
    }

    // Add session to microcycle's session order and context
    microcycle.sessionOrder.push(session._id);
    context.sessionsToCreate.push(session);
  }

  /**
   * Calculates the number of sets for an exercise based on microcycle progression.
   *
   * Formula: Start at 2 sets per exercise, add 1 total set per microcycle distributed
   * across all exercises (earlier exercises get priority).
   *
   * - Microcycle 1: Exercise 1 gets 2 sets, Exercise 2 gets 2 sets, etc.
   * - Microcycle 2: Exercise 1 gets 3 sets (gets the +1), Exercise 2 gets 2 sets
   * - Microcycle 3 (2 exercises): Exercise 1 gets 3 sets, Exercise 2 gets 3 sets (both get +1)
   *
   * @param microcycleIndex The current microcycle index (0-based).
   * @param totalExercisesInSession Total number of exercises for this muscle group in this session.
   * @param exerciseIndexInSession The index of this exercise within the session (0-based) for
   * the current muscle group.
   * @param isDeloadMicrocycle Whether this is a deload microcycle.
   */
  private static calculateSetCount(
    microcycleIndex: number,
    totalExercisesInSession: number,
    exerciseIndexInSession: number,
    isDeloadMicrocycle: boolean
  ): number {
    // Deload microcycle: half the sets from the previous microcycle, minimum 1 set
    if (isDeloadMicrocycle) {
      const baselineSets = this.calculateSetCount(
        microcycleIndex - 1,
        totalExercisesInSession,
        exerciseIndexInSession,
        false
      );
      return Math.max(1, Math.floor(baselineSets / 2));
    }

    // Total sets to distribute = (2 * number of exercises) + microcycle index
    const totalSets = 2 * totalExercisesInSession + microcycleIndex;

    // Distribute sets evenly, with earlier exercises getting extra sets from remainder
    const baseSetsPerExercise = Math.floor(totalSets / totalExercisesInSession);
    const remainder = totalSets % totalExercisesInSession;

    // If this exercise's index is less than the remainder, it gets an extra set
    return exerciseIndexInSession < remainder ? baseSetsPerExercise + 1 : baseSetsPerExercise;
  }
}
