import type { UUID } from 'crypto';
import type { CalibrationExercisePair } from '../../../documents/workout/WorkoutExerciseCalibration.js';
import type { WorkoutSession } from '../../../documents/workout/WorkoutSession.js';
import { WorkoutSessionSchema } from '../../../documents/workout/WorkoutSession.js';
import { WorkoutSessionExerciseSchema } from '../../../documents/workout/WorkoutSessionExercise.js';
import type WorkoutMesocyclePlanContext from '../Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutSetService from '../Set/WorkoutSetService.js';
import WorkoutSFRService from '../util/SFR/WorkoutSFRService.js';

/**
 * A service for handling operations related to {@link WorkoutSession}s.
 *
 * SCOPE: Session-level operations (calculating totals, managing session generation)
 *
 * RESPONSIBILITIES:
 * - Calculate session-level RSM/Fatigue totals
 * - Generate workout sessions with exercises and sets
 *
 * RELATED SERVICES:
 * - {@link WorkoutVolumePlanningService} - Provides set count plans for session generation
 * - {@link WorkoutSetService} - Generates individual sets within sessions
 * - {@link WorkoutSFRService} - Underlying calculations for RSM/Fatigue
 */
export default class WorkoutSessionService {
  /**
   * Calculates the total Raw Stimulus Magnitude for a session.
   */
  static getRsmTotal(session: WorkoutSession): number | null {
    return WorkoutSFRService.getRsmTotal(session.rsm);
  }

  /**
   * Calculates the total fatigue score for a session.
   */
  static getFatigueTotal(session: WorkoutSession): number | null {
    return WorkoutSFRService.getFatigueTotal(session.fatigue);
  }

  /**
   * Calculates the Stimulus to Fatigue Ratio (SFR) for a session.
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
    isDeloadMicrocycle,
    setPlan
  }: {
    context: WorkoutMesocyclePlanContext;
    microcycleIndex: number;
    sessionIndex: number;
    sessionStartDate: Date;
    sessionExerciseList: CalibrationExercisePair[];
    targetRir: number | null;
    isDeloadMicrocycle: boolean;
    setPlan: { exerciseIdToSetCount: Map<UUID, number>; recoveryExerciseIds: Set<UUID> };
  }): void {
    const mesocycle = context.mesocycle;
    const microcycle = context.microcyclesInOrder[microcycleIndex];

    const resolvedSetPlan = setPlan;

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

      const setCountFromPlan = resolvedSetPlan.exerciseIdToSetCount.get(exercise._id);
      if (setCountFromPlan == null) {
        throw new Error(
          `No set plan found for exercise ${exercise._id}, ${exercise.exerciseName} in microcycle ${microcycleIndex}`
        );
      }

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
        workoutExerciseId: exercise._id,
        isRecoveryExercise: resolvedSetPlan.recoveryExerciseIds.has(exercise._id)
      });

      WorkoutSetService.generateSetsForSessionExercise({
        context,
        exercise,
        calibration,
        session,
        sessionExercise,
        microcycleIndex,
        sessionIndex,
        setCount: setCountFromPlan,
        targetRir,
        isDeloadMicrocycle
      });

      const setsForThisExercise = context.setsToCreate.slice(-setCountFromPlan);

      sessionExercise.setOrder.push(...setsForThisExercise.map((s) => s._id));
      session.sessionExerciseOrder.push(sessionExercise._id);
      context.addSessionExercise(sessionExercise);
    }

    // Add session to microcycle's session order and context
    microcycle.sessionOrder.push(session._id);
    context.addSession(session);
  }
}
