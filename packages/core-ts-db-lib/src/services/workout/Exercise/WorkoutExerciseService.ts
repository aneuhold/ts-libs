import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';
import type { WorkoutExercise } from '../../../documents/workout/WorkoutExercise.js';
import {
  ExerciseProgressionType,
  ExerciseRepRange
} from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutExerciseCalibration } from '../../../documents/workout/WorkoutExerciseCalibration.js';
import WorkoutEquipmentTypeService from '../EquipmentType/WorkoutEquipmentTypeService.js';
import WorkoutExerciseCalibrationService from '../ExerciseCalibration/WorkoutExerciseCalibrationService.js';

/**
 * A service for handling operations related to {@link WorkoutExercise}s.
 */
export default class WorkoutExerciseService {
  /**
   * Returns the numeric rep range based on the ExerciseRepRange enum.
   *
   * - Heavy: { min: 5, max: 15 }
   * - Medium: { min: 10, max: 20 }
   * - Light: { min: 15, max: 30 }
   *
   * @param repRange The exercise rep range.
   */
  static getRepRangeValues(repRange: ExerciseRepRange): { min: number; max: number } {
    switch (repRange) {
      case ExerciseRepRange.Heavy:
        return { min: 5, max: 15 };
      case ExerciseRepRange.Medium:
        return { min: 10, max: 20 };
      case ExerciseRepRange.Light:
        return { min: 15, max: 30 };
    }
  }

  /**
   * Calculates the progressed target weight and reps for an exercise based on microcycle progression.
   * This returns the target weight and reps for the FIRST set of the exercise in the given microcycle,
   * assuming it is an accumulation phase (i.e., not a deload).
   *
   * This method applies either rep-based or load-based progression depending on the exercise's
   * preferred progression type, then rounds the weight to available equipment options.
   *
   * Rep progression: Works backward from max reps at the final accumulation microcycle.
   * The weight is calculated based on reps at microcycle 0, and reps increase by 2 per microcycle
   * to reach max reps at the final accumulation microcycle.
   *
   * Load progression: Increases weight by at least 2% per microcycle.
   * If weight can't be increased, adds 2 reps instead.
   *
   * @param params The parameters object.
   * @param params.exercise the workout exercise
   * @param params.calibration the workout exercise calibration
   * @param params.equipment the workout equipment type
   * @param params.microcycleIndex the zero-based microcycle index
   * @param params.targetRir the target RIR (Reps In Reserve)
   * @param params.totalAccumulationMicrocycles the total number of accumulation microcycles
   */
  static calculateProgressedTargets(params: {
    exercise: WorkoutExercise;
    calibration: WorkoutExerciseCalibration;
    equipment: WorkoutEquipmentType;
    microcycleIndex: number;
    targetRir: number;
    totalAccumulationMicrocycles: number;
  }): { targetWeight: number; targetReps: number } {
    const {
      exercise,
      calibration,
      equipment,
      microcycleIndex,
      targetRir,
      totalAccumulationMicrocycles
    } = params;

    // Validate equipment has weight options
    if (!equipment.weightOptions || equipment.weightOptions.length === 0) {
      throw new Error(
        `No weight options defined for equipment type ${equipment._id}, ${equipment.title}`
      );
    }

    // Get rep range for this exercise
    const repRange = this.getRepRangeValues(exercise.repRange);

    // For rep progression, calculate weight based on reps at microcycle 0
    // For load progression, use max reps
    let baseRepsForWeight: number;
    if (exercise.preferredProgressionType === ExerciseProgressionType.Rep) {
      // Work backward: final microcycle should hit max reps (before RIR)
      // Calculate how many reps we'd do at microcycle 0
      const lastAccumulationIndex = totalAccumulationMicrocycles - 1;
      baseRepsForWeight = repRange.max - lastAccumulationIndex * 2;
    } else {
      // Load progression uses max reps for initial weight calculation
      baseRepsForWeight = repRange.max;
    }

    // Calculate base weight
    let targetWeight = WorkoutExerciseCalibrationService.getTargetWeight(
      calibration,
      baseRepsForWeight
    );

    // Round to nearest available weight, preferring lower
    const roundedWeight = WorkoutEquipmentTypeService.findNearestWeight(
      equipment,
      targetWeight,
      'prefer-down'
    );
    if (roundedWeight === null) {
      throw new Error(
        `No available weight options found for equipment type ${equipment._id}, ${equipment.title}`
      );
    }
    targetWeight = roundedWeight;

    // Calculate target reps based on progression type
    let targetReps: number;
    if (exercise.preferredProgressionType === ExerciseProgressionType.Rep) {
      // Rep progression: Work backward from final microcycle
      const lastAccumulationIndex = totalAccumulationMicrocycles - 1;
      const baseReps = repRange.max - (lastAccumulationIndex - microcycleIndex) * 2;
      targetReps = baseReps - targetRir;
    } else {
      // Load progression: Start at max reps minus RIR
      targetReps = repRange.max - targetRir;
    }

    // Apply load progression if applicable
    if (exercise.preferredProgressionType === ExerciseProgressionType.Load && microcycleIndex > 0) {
      // Load progression: Increase weight by at least 2%
      const twoPercentIncrease = targetWeight * 1.02;

      // Find the smallest weight >= 2% increase (This is purposefully done from the rounded weight
      // because the rounded weight will be what the user would have actually lifted previously)
      const nextWeight = WorkoutEquipmentTypeService.findNearestWeight(
        equipment,
        twoPercentIncrease,
        'up'
      );

      if (nextWeight !== null) {
        targetWeight = nextWeight;
      } else {
        // Increase reps if we can't increase weight
        targetReps = targetReps + 2;
      }
    }

    return { targetWeight, targetReps };
  }
}
