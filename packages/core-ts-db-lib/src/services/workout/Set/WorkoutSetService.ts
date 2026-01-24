import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';
import type { WorkoutExercise } from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutExerciseCalibration } from '../../../documents/workout/WorkoutExerciseCalibration.js';
import { WorkoutSetSchema, type WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import WorkoutEquipmentTypeService from '../EquipmentType/WorkoutEquipmentTypeService.js';
import WorkoutExerciseService from '../Exercise/WorkoutExerciseService.js';

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
    exercise,
    calibration,
    equipment,
    microcycleIndex,
    sessionIndex,
    setCount,
    targetRir,
    firstMicrocycleRir,
    isDeloadMicrocycle,
    plannedSessionCountPerMicrocycle,
    userId,
    sessionId,
    sessionExerciseId
  }: {
    exercise: WorkoutExercise;
    calibration: WorkoutExerciseCalibration;
    equipment: WorkoutEquipmentType;
    microcycleIndex: number;
    sessionIndex: number;
    setCount: number;
    targetRir: number;
    firstMicrocycleRir: number;
    isDeloadMicrocycle: boolean;
    plannedSessionCountPerMicrocycle: number;
    userId: string;
    sessionId: string;
    sessionExerciseId: string;
  }): WorkoutSet[] {
    const sets: WorkoutSet[] = [];

    // Get rep range for this exercise
    const repRange = WorkoutExerciseService.getRepRangeValues(exercise.repRange);

    // Calculate progressed targets using WorkoutExerciseService
    const { targetWeight: firstSetWeight, targetReps: firstSetReps } =
      WorkoutExerciseService.calculateProgressedTargets({
        exercise,
        calibration,
        equipment,
        microcycleIndex,
        firstMicrocycleRir
      });

    // Create sets
    let currentWeight = firstSetWeight;
    let currentReps = firstSetReps;

    for (let setIndex = 0; setIndex < setCount; setIndex++) {
      // Ideally, drop 2 reps per set within the session (19 -> 17 -> 15, etc.)
      // But if that would go below the min reps, keep it at min reps.
      if (currentReps - 2 < repRange.min && setIndex > 0) {
        // Reduce weight by 2% using the same technique as progression
        const twoPercentDecrease = currentWeight / 1.02;
        const reducedWeight = WorkoutEquipmentTypeService.findNearestWeight(
          equipment,
          twoPercentDecrease,
          'down'
        );
        if (reducedWeight !== null) {
          currentWeight = reducedWeight;
        } else if (currentReps - 2 > 5) {
          // If we can't reduce weight, but we can reduce reps without going too low,
          // then do that.
          currentReps = currentReps - 2;
        }
      } else if (setIndex > 0) {
        currentReps = currentReps - 2;
      }

      const plannedWeight = currentWeight;

      // Apply deload modifications
      let deloadReps = currentReps;
      let deloadWeight = plannedWeight;
      if (isDeloadMicrocycle) {
        deloadReps = Math.floor(currentReps / 2);
        // First half of deload microcycle: same weight, half reps/sets
        // Second half: half weight too
        if (sessionIndex >= Math.floor(plannedSessionCountPerMicrocycle / 2)) {
          deloadWeight = Math.floor(plannedWeight / 2);
        }
      }

      const workoutSet = WorkoutSetSchema.parse({
        userId: userId,
        workoutExerciseId: exercise._id,
        workoutSessionId: sessionId,
        workoutSessionExerciseId: sessionExerciseId,
        plannedReps: isDeloadMicrocycle ? deloadReps : currentReps,
        plannedWeight: isDeloadMicrocycle ? deloadWeight : plannedWeight,
        plannedRir: targetRir,
        exerciseProperties: calibration.exerciseProperties
      });

      sets.push(workoutSet);
    }

    return sets;
  }
}
