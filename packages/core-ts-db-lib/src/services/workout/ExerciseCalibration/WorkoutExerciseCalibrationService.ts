import type { UUID } from 'crypto';
import type { WorkoutExerciseCTO } from '../../../ctos/workout/WorkoutExerciseCTO.js';
import type { WorkoutExerciseCalibration } from '../../../documents/workout/WorkoutExerciseCalibration.js';
import { WorkoutExerciseCalibrationSchema } from '../../../documents/workout/WorkoutExerciseCalibration.js';

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
   * Generates auto-calibrations from exercise CTOs whose best set 1RM exceeds
   * their best calibration 1RM.
   *
   * The CTO already provides `bestCalibration` and `bestSet` per exercise, so
   * this method just compares those two pre-computed values and creates new
   * calibrations where the set wins.
   *
   * @param exerciseCTOs The exercise CTOs to evaluate.
   * @param userId The user ID for the new calibrations.
   * @param dateRecorded The date to use as dateRecorded for new calibrations.
   */
  static generateAutoCalibrations(
    exerciseCTOs: WorkoutExerciseCTO[],
    userId: UUID,
    dateRecorded: Date
  ): WorkoutExerciseCalibration[] {
    const newCalibrations: WorkoutExerciseCalibration[] = [];

    for (const cto of exerciseCTOs) {
      const { bestSet, bestCalibration } = cto;
      if (!bestSet?.actualWeight || !bestSet.actualReps || bestSet.actualReps <= 0) continue;

      const set1RM = this.get1RMRaw(bestSet.actualWeight, bestSet.actualReps);
      const cal1RM = bestCalibration ? this.get1RM(bestCalibration) : 0;

      if (set1RM > cal1RM) {
        newCalibrations.push(
          WorkoutExerciseCalibrationSchema.parse({
            userId,
            workoutExerciseId: cto._id,
            weight: bestSet.actualWeight,
            reps: bestSet.actualReps,
            exerciseProperties: bestSet.exerciseProperties,
            dateRecorded,
            associatedWorkoutSetId: bestSet._id
          })
        );
      }
    }

    return newCalibrations;
  }

  /**
   * Calculates the target percentage of 1RM for a given target rep count.
   *
   * Uses the formula: targetPercentage = 85 - ((targetReps - 5) * 2.2)
   *
   * This ensures training stays within the 85%-30% 1RM range (5 reps to 30 reps).
   * Higher rep counts produce lower percentages of 1RM.
   *
   * @param targetReps The target number of reps.
   */
  private static getTargetPercentage(targetReps: number): number {
    return 85 - (targetReps - 5) * 2.2;
  }
}
