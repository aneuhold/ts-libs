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
  static calculate1RM(calibration: WorkoutExerciseCalibration): number {
    return (calibration.weight * calibration.reps) / 30.48 + calibration.weight;
  }
}
