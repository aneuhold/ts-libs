import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';
import type {
  ExerciseRepRange,
  WorkoutExercise
} from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutExerciseCalibration } from '../../../documents/workout/WorkoutExerciseCalibration.js';
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
   */
  static generateSetsForSessionExercise({
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
  }: {
    context: WorkoutMesocyclePlanContext;
    exercise: WorkoutExercise;
    calibration: WorkoutExerciseCalibration;
    session: WorkoutSession;
    sessionExercise: WorkoutSessionExercise;
    microcycleIndex: number;
    sessionIndex: number;
    setCount: number;
    targetRir: number | null;
    isDeloadMicrocycle: boolean;
  }): void {
    const equipment = context.equipmentMap.get(exercise.workoutEquipmentTypeId);
    if (!equipment) {
      throw new Error(
        `Equipment type not found for exercise ${exercise._id}, ${exercise.exerciseName}`
      );
    }

    const sets: WorkoutSet[] = [];

    // Calculate progressed targets for the first set
    const { targetWeight: firstSetWeight, targetReps: firstSetReps } =
      WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
        exercise,
        calibration,
        equipment,
        microcycleIndex,
        firstMicrocycleRir: context.FIRST_MICROCYCLE_RIR
      });

    for (let setIndex = 0; setIndex < setCount; setIndex++) {
      const { plannedReps, plannedWeight } = this.generateSetRepsAndWeight(
        // If there is a previous set, base off that, otherwise use first set targets
        sets[setIndex - 1]?.plannedReps || firstSetReps,
        sets[setIndex - 1]?.plannedWeight || firstSetWeight,
        setIndex,
        exercise.repRange,
        equipment,
        {
          isDeloadMicrocycle,
          sessionIndex,
          plannedSessionCountPerMicrocycle: context.mesocycle.plannedSessionCountPerMicrocycle
        }
      );

      const workoutSet = WorkoutSetSchema.parse({
        userId: exercise.userId,
        workoutExerciseId: exercise._id,
        workoutSessionId: session._id,
        workoutSessionExerciseId: sessionExercise._id,
        plannedReps,
        plannedWeight,
        plannedRir: targetRir,
        exerciseProperties: calibration.exerciseProperties
      });

      sets.push(workoutSet);
    }

    context.setsToCreate.push(...sets);
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
        currentWeight = Math.floor(currentWeight / 2);
      }
    }

    return { plannedReps: currentReps, plannedWeight: currentWeight };
  }
}
