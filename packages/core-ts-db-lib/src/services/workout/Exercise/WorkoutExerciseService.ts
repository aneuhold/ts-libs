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
   *
   * This method applies either rep-based or load-based progression depending on the exercise's
   * preferred progression type, then rounds the weight to available equipment options.
   *
   * Rep progression: Adds 2 reps per microcycle, capped at the max rep range.
   * Load progression: Increases weight by smallest increment or 2%, whichever is greater.
   * If weight can't be increased, adds 2 reps instead.
   *
   * @param params The parameters object.
   * @param params.exercise the workout exercise
   * @param params.calibration the workout exercise calibration
   * @param params.equipment the workout equipment type
   * @param params.microcycleIndex the zero-based microcycle index
   * @param params.targetRir the target RIR (Reps In Reserve)
   */
  static calculateProgressedTargets(params: {
    exercise: WorkoutExercise;
    calibration: WorkoutExerciseCalibration;
    equipment: WorkoutEquipmentType;
    microcycleIndex: number;
    targetRir: number;
  }): { targetWeight: number; targetReps: number } {
    const { exercise, calibration, equipment, microcycleIndex, targetRir } = params;

    // Validate equipment has weight options
    if (!equipment.weightOptions || equipment.weightOptions.length === 0) {
      throw new Error(
        `No weight options defined for equipment type ${equipment._id}, ${equipment.title}`
      );
    }

    // Get rep range for this exercise
    const repRange = this.getRepRangeValues(exercise.repRange);

    // Calculate base weight at max reps (we subtract RIR separately from reps)
    let targetWeight = WorkoutExerciseCalibrationService.getTargetWeight(calibration, repRange.max);

    // Calculate target reps (start at max, subtract RIR)
    let targetReps = repRange.max - targetRir;

    // Apply progression based on exercise type
    if (exercise.preferredProgressionType === ExerciseProgressionType.Rep) {
      // Rep progression: Add 2 reps per microcycle, cap at max
      targetReps = targetReps + microcycleIndex * 2;
      targetReps = Math.min(targetReps, repRange.max);
    } else if (
      exercise.preferredProgressionType === ExerciseProgressionType.Load &&
      microcycleIndex > 0
    ) {
      // Load progression: Increase weight by 2% or next increment, whichever is greater
      const twoPercentIncrease = targetWeight * 0.02 + targetWeight;

      // Find next available weight option
      const currentIndex = equipment.weightOptions.findIndex((w) => w >= targetWeight);
      if (currentIndex >= 0 && currentIndex < equipment.weightOptions.length - 1) {
        targetWeight = equipment.weightOptions[currentIndex + 1];
        if (targetWeight < twoPercentIncrease) {
          // Try to find a weight that meets the 2% increase
          const twoPercentIndex = equipment.weightOptions.findIndex((w) => w >= twoPercentIncrease);
          if (twoPercentIndex !== -1) {
            targetWeight = equipment.weightOptions[twoPercentIndex];
          }
        }
      } else {
        // Increase reps if we can't increase weight
        targetReps = targetReps + 2;
      }
    }

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

    return { targetWeight, targetReps };
  }
}
