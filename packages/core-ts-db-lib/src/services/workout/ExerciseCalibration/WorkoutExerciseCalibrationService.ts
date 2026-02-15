import type { WorkoutExerciseCalibration } from '../../../documents/workout/WorkoutExerciseCalibration.js';

/**
 * A service for handling operations related to {@link WorkoutExerciseCalibration}s.
 */
export default class WorkoutExerciseCalibrationService {
  /**
   * Calculates the 1 Rep Max using the NASM formula.
   *
   * Formula: (Weight Lifted × Reps / 30.48) + Weight Lifted
   *
   * @param calibration The workout exercise calibration.
   */
  static get1RM(calibration: WorkoutExerciseCalibration): number {
    return this.get1RMRaw(calibration.weight, calibration.reps);
  }

  /**
   * Calculates the 1 Rep Max using the NASM formula based on provided weight and reps.
   *
   * @param weight The weight lifted.
   * @param reps The number of reps performed.
   */
  static get1RMRaw(weight: number, reps: number): number {
    return (weight * reps) / 30.48 + weight;
  }

  /**
   * Calculates the target weight for a set based on target reps and 1RM.
   *
   * Returns the calculated weight without rounding. Consumer can use
   * WorkoutEquipmentTypeService.findNearestWeight() to round if needed.
   *
   * @param calibration The workout exercise calibration.
   * @param targetReps The target number of reps.
   */
  static getTargetWeight(calibration: WorkoutExerciseCalibration, targetReps: number): number {
    const oneRepMax = this.get1RM(calibration);
    const targetPercentage = this.getTargetPercentage(targetReps);
    return (targetPercentage / 100) * oneRepMax;
  }

  /**
   * Calculates the target percentage of 1RM for a given target rep count.
   *
   * Uses the formula: targetPercentage = 30 + ((targetReps - 5) * 2.2)
   *
   * This ensures training stays within the 30%-85% 1RM range (30 reps to 5 reps).
   *
   * @param targetReps The target number of reps.
   */
  private static getTargetPercentage(targetReps: number): number {
    return 30 + (targetReps - 5) * 2.2;
  }
}
