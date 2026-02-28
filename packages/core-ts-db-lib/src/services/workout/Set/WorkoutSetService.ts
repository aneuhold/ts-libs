import type { UUID } from 'crypto';
import type { WorkoutExerciseCTO } from '../../../ctos/workout/WorkoutExerciseCTO.js';
import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';
import type { ExerciseRepRange } from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutSession } from '../../../documents/workout/WorkoutSession.js';
import type { WorkoutSessionExercise } from '../../../documents/workout/WorkoutSessionExercise.js';
import { WorkoutSetSchema, type WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import WorkoutEquipmentTypeService from '../EquipmentType/WorkoutEquipmentTypeService.js';
import WorkoutExerciseService from '../Exercise/WorkoutExerciseService.js';
import type WorkoutMesocyclePlanContext from '../Mesocycle/WorkoutMesocyclePlanContext.js';

export default class WorkoutSetService {
  /**
   * Generates a list of workout sets for a given session exercise based on progression logic.
   *
   * This handles the "micro" decisions of load selection:
   * - Calculating the initial target weight/reps based on microcycle progression.
   * - Handling intra-session fatigue (dropping reps/weight across sets).
   * - Applying Deload phase modifications (cutting volume/intensity).
   * - Using previous performance data to adjust progression via autoregulation.
   */
  static generateSetsForSessionExercise({
    context,
    exerciseCTO,
    session,
    sessionExercise,
    microcycleIndex,
    sessionIndex,
    setCount,
    targetRir,
    isDeloadMicrocycle
  }: {
    context: WorkoutMesocyclePlanContext;
    exerciseCTO: WorkoutExerciseCTO;
    session: WorkoutSession;
    sessionExercise: WorkoutSessionExercise;
    microcycleIndex: number;
    sessionIndex: number;
    setCount: number;
    targetRir: number | null;
    isDeloadMicrocycle: boolean;
  }): void {
    const { equipmentType, bestCalibration } = exerciseCTO;
    if (!bestCalibration) {
      throw new Error(
        `No calibration found for exercise ${exerciseCTO._id}, ${exerciseCTO.exerciseName}`
      );
    }

    const sets: WorkoutSet[] = [];

    // For the first microcycle, use the CTO's previous performance data.
    // For subsequent microcycles, look up the previous microcycle's first set from the context.
    const previousFirstSet =
      microcycleIndex === 0
        ? (exerciseCTO.lastFirstSet ?? undefined)
        : this.findPreviousFirstSet(context, exerciseCTO._id, microcycleIndex);

    // Calculate progressed targets for the first set.
    // For deload microcycles, use the previous microcycle's index so we base
    // the deload on the last accumulation weight rather than progressing further.
    const { targetReps: firstSetReps, targetWeight: firstSetWeight } =
      WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
        exercise: exerciseCTO,
        calibration: bestCalibration,
        equipment: equipmentType,
        microcycleIndex: isDeloadMicrocycle ? microcycleIndex - 1 : microcycleIndex,
        firstMicrocycleRir: context.firstMicrocycleRir,
        previousFirstSet
      });

    for (let setIndex = 0; setIndex < setCount; setIndex++) {
      const { plannedReps, plannedWeight } = this.generateSetRepsAndWeight(
        sets[setIndex - 1]?.plannedReps || firstSetReps,
        sets[setIndex - 1]?.plannedWeight || firstSetWeight,
        setIndex,
        exerciseCTO.repRange,
        equipmentType,
        {
          isDeloadMicrocycle,
          sessionIndex,
          plannedSessionCountPerMicrocycle: context.mesocycle.plannedSessionCountPerMicrocycle
        }
      );

      const workoutSet = WorkoutSetSchema.parse({
        userId: exerciseCTO.userId,
        workoutExerciseId: exerciseCTO._id,
        workoutSessionId: session._id,
        workoutSessionExerciseId: sessionExercise._id,
        plannedReps,
        plannedWeight,
        plannedRir: targetRir,
        exerciseProperties: bestCalibration.exerciseProperties
      });

      sets.push(workoutSet);
    }

    context.addSets(sets);
  }

  /**
   * Returns true if the set has been logged (has actual performance data).
   * A set is considered completed when actualReps and actualWeight are recorded,
   * and either rir is recorded or no plannedRir was expected (deload sets).
   */
  static isCompleted(set: WorkoutSet): boolean {
    return (
      set.actualReps != null &&
      set.actualWeight != null &&
      (set.rir != null || set.plannedRir == null)
    );
  }

  /**
   * Finds the previous microcycle's first set for an exercise to use for autoregulation.
   *
   * Uses the mesocycle's fixed exercise-to-session mapping to go directly to the
   * correct session and exercise position rather than iterating all sessions.
   *
   * Returns undefined if the previous microcycle doesn't exist or has no sessions
   * (the context may not have full history). Throws if the structure is present but
   * inconsistent with the mesocycle plan.
   *
   * @throws {Error} If the session/exercise structure doesn't match the plan.
   */
  private static findPreviousFirstSet(
    context: WorkoutMesocyclePlanContext,
    exerciseId: UUID,
    microcycleIndex: number
  ): WorkoutSet | undefined {
    if (microcycleIndex <= 0) {
      return undefined;
    }

    const previousMicrocycle = context.microcyclesInOrder[microcycleIndex - 1];
    if (!previousMicrocycle || previousMicrocycle.sessionOrder.length === 0) {
      return undefined;
    }

    // Exercise-to-session mapping is fixed for the mesocycle — look up directly
    const sessionIndex = context.exerciseIdToSessionIndex?.get(exerciseId);
    if (sessionIndex == null) {
      throw new Error(`Exercise ${exerciseId} has no session mapping in the mesocycle plan`);
    }

    const sessionId = previousMicrocycle.sessionOrder[sessionIndex];
    if (!sessionId) {
      throw new Error(
        `Previous microcycle has no session at index ${sessionIndex} for exercise ${exerciseId}`
      );
    }

    const session = context.sessionMap.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found in context`);
    }

    // Exercise order within a session is consistent — find the index from the plan
    const plannedCTOs = context.plannedSessionExerciseCTOs?.[sessionIndex];
    if (!plannedCTOs) {
      throw new Error(`No planned CTOs for session index ${sessionIndex}`);
    }

    const exerciseIndex = plannedCTOs.findIndex((cto) => cto._id === exerciseId);
    if (exerciseIndex === -1) {
      throw new Error(
        `Exercise ${exerciseId} not found in planned CTOs for session ${sessionIndex}`
      );
    }

    const seId = session.sessionExerciseOrder[exerciseIndex];
    if (!seId) {
      throw new Error(`No session exercise at index ${exerciseIndex} in session ${sessionId}`);
    }

    const sessionExercise = context.sessionExerciseMap.get(seId);
    if (!sessionExercise) {
      throw new Error(`Session exercise ${seId} not found in context`);
    }

    const firstSetId = sessionExercise.setOrder[0];
    if (!firstSetId) {
      throw new Error(`Session exercise ${seId} for exercise ${exerciseId} has no sets`);
    }

    const set = context.setMap.get(firstSetId);
    if (!set) {
      throw new Error(`Set ${firstSetId} not found in context`);
    }
    return set;
  }

  /**
   * Generates the planned reps and weight for a specific set within a session exercise, only
   * taking into account simple -2 reps drop per set logic, and deload modifications.
   *
   * This needs to be checked with the source material to see if it needs to be adjusted based
   * on actual reps performed in previous sets.
   */
  private static generateSetRepsAndWeight(
    firstSetOrPreviousSetReps: number,
    firstSetOrPreviousSetWeight: number,
    setIndex: number,
    repRange: ExerciseRepRange,
    equipment: WorkoutEquipmentType,
    deloadInfo: {
      isDeloadMicrocycle: boolean;
      sessionIndex: number;
      plannedSessionCountPerMicrocycle: number;
    }
  ) {
    const repRangeValues = WorkoutExerciseService.getRepRangeValues(repRange);
    let currentReps = firstSetOrPreviousSetReps;
    let currentWeight = firstSetOrPreviousSetWeight;

    // Ideally, drop 2 reps per set within the session (19 -> 17 -> 15, etc.)
    // But if that would go below the min reps, keep it at min reps.
    if (firstSetOrPreviousSetReps - 2 < repRangeValues.min && setIndex > 0) {
      // Reduce weight by 2% using the same technique as progression
      const twoPercentDecrease = currentWeight / 1.02;
      const reducedWeight = WorkoutEquipmentTypeService.findNearestWeight(
        equipment,
        twoPercentDecrease,
        'down'
      );
      if (reducedWeight !== null) {
        currentWeight = reducedWeight;
      } else if (firstSetOrPreviousSetReps - 2 > 5) {
        // If we can't reduce weight, but we can reduce reps without going too low,
        // then do that.
        currentReps = firstSetOrPreviousSetReps - 2;
      }
    } else if (setIndex > 0) {
      currentReps = firstSetOrPreviousSetReps - 2;
    }

    // Apply deload modifications, but only if the set is the first in the session
    if (deloadInfo.isDeloadMicrocycle && setIndex === 0) {
      currentReps = Math.floor(firstSetOrPreviousSetReps / 2);
      // First half of deload microcycle: same weight, half reps/sets
      // Second half: half weight too
      if (deloadInfo.sessionIndex >= Math.floor(deloadInfo.plannedSessionCountPerMicrocycle / 2)) {
        const halvedWeight = currentWeight / 2;
        const nearestWeight = WorkoutEquipmentTypeService.findNearestWeight(
          equipment,
          halvedWeight,
          'prefer-down'
        );
        currentWeight = nearestWeight ?? Math.floor(halvedWeight);
      }
    }

    return { plannedReps: currentReps, plannedWeight: currentWeight };
  }
}
