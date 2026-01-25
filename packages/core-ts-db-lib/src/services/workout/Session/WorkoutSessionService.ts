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

    if (!context.muscleGroupToExercisePairsMap) {
      throw new Error(
        'WorkoutMesocyclePlanContext.muscleGroupToExercisePairsMap is not initialized. This should be set during mesocycle planning.'
      );
    }

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

      // Validation: ensure we can find the muscle-group-wide ordering for this exercise
      const primaryMuscleGroupId = exercise.primaryMuscleGroups[0];
      if (!primaryMuscleGroupId) {
        throw new Error(
          `Exercise ${exercise._id}, ${exercise.exerciseName} has no primary muscle group`
        );
      }
      const muscleGroupExercisePairs =
        context.muscleGroupToExercisePairsMap.get(primaryMuscleGroupId);
      if (!muscleGroupExercisePairs || muscleGroupExercisePairs.length === 0) {
        throw new Error(
          `No microcycle exercise ordering found for muscle group ${primaryMuscleGroupId} (exercise ${exercise._id}, ${exercise.exerciseName})`
        );
      }
      const exerciseIndexInMuscleGroupForMicrocycle = muscleGroupExercisePairs.findIndex(
        (pair) => pair.exercise._id === exercise._id
      );
      if (exerciseIndexInMuscleGroupForMicrocycle === -1) {
        throw new Error(
          `Exercise ${exercise._id}, ${exercise.exerciseName} not found in muscle-group-wide microcycle ordering`
        );
      }

      // Calculate number of sets for this exercise in this microcycle
      const setCount = this.calculateSetCount(
        microcycleIndex,
        muscleGroupExercisePairs.length,
        exerciseIndexInMuscleGroupForMicrocycle,
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
   * Key rule: set progression is distributed across exercises that share the same primary muscle group
   * for the entire microcycle, regardless of which session those exercises are in.
   *
   * Baseline: 2 sets per exercise in the muscle group.
   * Progression: add 1 total set per microcycle per muscle group (distributed to earlier exercises
   * in the muscle-group-wide ordering).
   */
  private static calculateSetCount(
    microcycleIndex: number,
    totalExercisesInMuscleGroupForMicrocycle: number,
    exerciseIndexInMuscleGroupForMicrocycle: number,
    isDeloadMicrocycle: boolean
  ): number {
    // Deload microcycle: half the sets from the previous microcycle, minimum 1 set.
    if (isDeloadMicrocycle) {
      const baselineSets = this.calculateSetCount(
        microcycleIndex - 1,
        totalExercisesInMuscleGroupForMicrocycle,
        exerciseIndexInMuscleGroupForMicrocycle,
        false
      );
      return Math.max(1, Math.floor(baselineSets / 2));
    }

    // Total sets to distribute for this muscle group in this microcycle.
    // For now, add exactly +1 total set per microcycle per muscle group.
    const totalSets = 2 * totalExercisesInMuscleGroupForMicrocycle + microcycleIndex;

    // Distribute sets evenly, with earlier exercises getting extra sets from the remainder.
    const baseSetsPerExercise = Math.floor(totalSets / totalExercisesInMuscleGroupForMicrocycle);
    const remainder = totalSets % totalExercisesInMuscleGroupForMicrocycle;

    return exerciseIndexInMuscleGroupForMicrocycle < remainder
      ? baseSetsPerExercise + 1
      : baseSetsPerExercise;
  }
}
