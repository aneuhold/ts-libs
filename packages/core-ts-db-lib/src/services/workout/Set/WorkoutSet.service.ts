import type { UUID } from 'crypto';
import type { WorkoutExerciseCTO } from '../../../ctos/workout/WorkoutExerciseCTO.js';
import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';
import type { ExerciseRepRange } from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutSession } from '../../../documents/workout/WorkoutSession.js';
import type { WorkoutSessionExercise } from '../../../documents/workout/WorkoutSessionExercise.js';
import { WorkoutSetSchema, type WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import WorkoutEquipmentTypeService from '../EquipmentType/WorkoutEquipmentType.service.js';
import WorkoutExerciseService from '../Exercise/WorkoutExercise.service.js';
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

    // For the first microcycle, use the CTO's previous accumulation performance
    // data. For subsequent microcycles, look up all previous sets from the context.
    const previousSets =
      microcycleIndex === 0
        ? exerciseCTO.lastAccumulationSessionSets
        : this.#findPreviousSets(context, exerciseCTO._id, microcycleIndex);

    // Calculate progressed targets for the first set.
    // Autoregulation/forecasting handles progression from the previous sets' data.
    // Surplus is averaged across all sets for a holistic performance signal.
    // Calibration is only used when no previous set exists (first microcycle ever).
    const { targetReps: firstSetReps, targetWeight: firstSetWeight } =
      WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
        exercise: exerciseCTO,
        calibration: bestCalibration,
        equipment: equipmentType,
        firstMicrocycleRir: context.firstMicrocycleRir,
        previousSets
      });

    for (let setIndex = 0; setIndex < setCount; setIndex++) {
      const { plannedReps, plannedWeight } = this.#generateSetRepsAndWeight(
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
   * Finds the sets an exercise was last programmed for, to use for autoregulation.
   * Returns all sets in order so surplus can be averaged across the full exercise performance.
   *
   * Walks backward from the microcycle before `microcycleIndex` and returns the first entry for
   * the exercise that holds sets, so an exercise missing from the immediately preceding microcycle
   * progresses from the most recent microcycle that has it rather than resetting.
   * Recovery entries are skipped so a deliberate volume reduction does not ratchet progression down.
   *
   * Returns an empty array when the exercise has no non-recovery history earlier in the mesocycle,
   * which puts the caller on the calibration path.
   *
   * @throws {Error} If a set referenced by the session exercise is missing from the context.
   */
  static #findPreviousSets(
    context: WorkoutMesocyclePlanContext,
    exerciseId: UUID,
    microcycleIndex: number
  ): WorkoutSet[] {
    for (let index = microcycleIndex - 1; index >= 0; index--) {
      const sessionExercise =
        context.microcyclesInOrder[index]?.exerciseToSessionExercise.get(exerciseId);
      if (
        !sessionExercise ||
        sessionExercise.isRecoveryExercise ||
        sessionExercise.setOrder.length === 0
      ) {
        continue;
      }

      return sessionExercise.setOrder.map((setId) => {
        const set = context.setMap.get(setId);
        if (!set) {
          throw new Error(`Set ${setId} not found in context`);
        }
        return set;
      });
    }

    return [];
  }

  /**
   * Generates the planned reps and weight for a specific set within a session exercise, only
   * taking into account simple -2 reps drop per set logic, and deload modifications.
   *
   * This needs to be checked with the source material to see if it needs to be adjusted based
   * on actual reps performed in previous sets.
   */
  static #generateSetRepsAndWeight(
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
