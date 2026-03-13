import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';
import type { WorkoutExercise } from '../../../documents/workout/WorkoutExercise.js';
import {
  ExerciseProgressionType,
  ExerciseRepRange
} from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutExerciseCalibration } from '../../../documents/workout/WorkoutExerciseCalibration.js';
import type { CompletedWorkoutSet, WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import WorkoutEquipmentTypeService from '../EquipmentType/WorkoutEquipmentTypeService.js';
import WorkoutExerciseCalibrationService from '../ExerciseCalibration/WorkoutExerciseCalibrationService.js';
import WorkoutSessionExerciseService from '../SessionExercise/WorkoutSessionExerciseService.js';
import WorkoutSFRService from '../util/SFR/WorkoutSFRService.js';

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
   * Gets the fatigue score for an exercise.
   *
   * @param exercise The exercise to get the fatigue score for.
   */
  static getFatigueScore(exercise: WorkoutExercise): number {
    return WorkoutSFRService.getFatigueTotal(exercise.initialFatigueGuess) || 0;
  }

  /**
   * Calculates the target weight and reps for the FIRST set of an exercise.
   *
   * When a `previousFirstSet` is provided (completed or planned-only), autoregulation
   * computes a surplus and applies progression. Planned-only sets are forecasted with
   * surplus = 0 so the plan progresses smoothly without falling back to calibration.
   *
   * When no previous set exists (first mesocycle or new exercise), the calibration-based
   * formula computes initial targets from the exercise's 1RM and rep range.
   */
  static calculateTargetRepsAndWeightForFirstSet(params: {
    exercise: WorkoutExercise;
    calibration: WorkoutExerciseCalibration;
    equipment: WorkoutEquipmentType;
    firstMicrocycleRir: number;
    previousFirstSet?: WorkoutSet;
  }): { targetWeight: number; targetReps: number } {
    const { exercise, calibration, equipment, firstMicrocycleRir, previousFirstSet } = params;

    // Validate equipment has weight options
    if (!equipment.weightOptions || equipment.weightOptions.length === 0) {
      throw new Error(
        `No weight options defined for equipment type ${equipment._id}, ${equipment.title}`
      );
    }

    // Get rep range for this exercise
    const repRange = this.getRepRangeValues(exercise.repRange);
    const repRangeMidpoint = Math.floor((repRange.min + repRange.max) / 2);

    // When a previous set is available, use autoregulation for progression.
    // toCompletedSet returns the real data when actual performance exists, or
    // forecasts by copying planned values into actuals (surplus = 0) so the
    // plan progresses smoothly from the planned baseline.
    const completedPreviousSet = this.toCompletedSet(previousFirstSet);
    if (completedPreviousSet) {
      return this.calculateAutoRegulatedTargets({
        exercise,
        equipment,
        previousFirstSet: completedPreviousSet,
        repRange
      });
    }

    // Calibration-based formula (no previous set available)
    return this.calculateCalibrationBasedTargets({
      exercise,
      calibration,
      equipment,
      firstMicrocycleRir,
      repRange,
      repRangeMidpoint
    });
  }

  /**
   * Calculates targets using auto-regulation based on actual performance from a previous set.
   */
  private static calculateAutoRegulatedTargets(params: {
    exercise: WorkoutExercise;
    equipment: WorkoutEquipmentType;
    previousFirstSet: CompletedWorkoutSet;
    repRange: { min: number; max: number };
  }): { targetWeight: number; targetReps: number } {
    const { exercise, equipment, previousFirstSet, repRange } = params;

    const surplus = WorkoutSessionExerciseService.calculateSetSurplus(
      previousFirstSet.actualReps,
      previousFirstSet.plannedReps,
      previousFirstSet.rir,
      previousFirstSet.plannedRir
    );

    if (exercise.preferredProgressionType === ExerciseProgressionType.Rep) {
      return this.calculateAutoRegulatedRepTargets(previousFirstSet, surplus, repRange, equipment);
    }

    return this.calculateAutoRegulatedLoadTargets(previousFirstSet, surplus, repRange, equipment);
  }

  /**
   * Auto-regulated rep progression. Attempts to increase reps until hitting rep range max,
   * then resets reps and increases weight.
   *
   * | Surplus | Action |
   * |---:|---|
   * | >= 3 | Accelerate: actualReps + 2 (progress from actual, not planned) |
   * | 0 to 2 | Normal: plannedReps + 2 |
   * | -1 to -2 | Hold: plannedReps (don't add reps) |
   * | <= -3 | Regress: actualReps (use actual as new baseline) |
   */
  private static calculateAutoRegulatedRepTargets(
    previousSet: CompletedWorkoutSet,
    surplus: number,
    repRange: { min: number; max: number },
    equipment: WorkoutEquipmentType
  ): { targetWeight: number; targetReps: number } {
    let targetReps: number;
    let targetWeight = previousSet.plannedWeight;

    if (surplus >= 3) {
      targetReps = previousSet.actualReps + 2;
    } else if (surplus >= 0) {
      targetReps = previousSet.plannedReps + 2;
    } else if (surplus >= -2) {
      targetReps = previousSet.plannedReps;
    } else {
      targetReps = previousSet.actualReps;
    }

    // Clamp to rep range floor (never target below min, even if actual was 0)
    targetReps = Math.max(targetReps, repRange.min);

    // Handle rep range ceiling: if target exceeds max, reset and bump weight
    if (targetReps > repRange.max) {
      targetReps = Math.floor((repRange.min + repRange.max) / 2);
      const nextWeight = this.findNextTwoPercentWeight(targetWeight, equipment);
      if (nextWeight !== null) {
        targetWeight = nextWeight;
      }
    }

    // Round weight to equipment
    const roundedWeight = WorkoutEquipmentTypeService.findNearestWeight(
      equipment,
      targetWeight,
      'prefer-down'
    );
    if (roundedWeight !== null) {
      targetWeight = roundedWeight;
    }

    return { targetWeight, targetReps };
  }

  /**
   * Auto-regulated load progression. Reps stay at rep range max, weight adjusts based on surplus.
   *
   * | Surplus | Action |
   * |---:|---|
   * | >= 2 | Accelerate: increase weight by ~4% |
   * | 0 to 1 | Normal: increase weight by 2% |
   * | -1 to -2 | Hold weight (no increase) |
   * | <= -3 | Reduce weight by minimum equipment increment |
   */
  private static calculateAutoRegulatedLoadTargets(
    previousSet: CompletedWorkoutSet,
    surplus: number,
    repRange: { min: number; max: number },
    equipment: WorkoutEquipmentType
  ): { targetWeight: number; targetReps: number } {
    const targetReps = repRange.max;
    let targetWeight = previousSet.plannedWeight;

    if (surplus >= 2) {
      // Accelerate: increase by ~4%
      const fourPercentIncrease = targetWeight * 1.04;
      const nextWeight = WorkoutEquipmentTypeService.findNearestWeight(
        equipment,
        fourPercentIncrease,
        'up'
      );
      if (nextWeight !== null) {
        targetWeight = nextWeight;
      }
    } else if (surplus >= 0) {
      // Normal: increase by 2%
      const nextWeight = this.findNextTwoPercentWeight(targetWeight, equipment);
      if (nextWeight !== null) {
        targetWeight = nextWeight;
      }
    } else if (surplus >= -2) {
      // Hold weight - no change
    } else {
      // Reduce by minimum equipment increment
      const reducedWeight = WorkoutEquipmentTypeService.findNearestWeight(
        equipment,
        targetWeight - 0.01,
        'down'
      );
      if (reducedWeight !== null) {
        targetWeight = reducedWeight;
      }
    }

    return { targetWeight, targetReps };
  }

  /**
   * Converts a {@link WorkoutSet} into a {@link CompletedWorkoutSet} for autoregulation.
   *
   * If actual performance data exists, returns the set with those values. Otherwise,
   * forecasts by copying planned values into the actual fields (producing surplus = 0)
   * so that autoregulation applies normal progression from the planned baseline.
   *
   * Returns null if the set lacks the minimum planned data needed.
   */
  private static toCompletedSet(set?: WorkoutSet): CompletedWorkoutSet | null {
    if (!set) {
      return null;
    }
    const { plannedReps, plannedWeight, plannedRir } = set;
    if (plannedReps == null || plannedWeight == null || plannedRir == null) {
      return null;
    }
    return {
      ...set,
      plannedReps,
      plannedWeight,
      plannedRir,
      actualReps: set.actualReps ?? plannedReps,
      actualWeight: set.actualWeight ?? plannedWeight,
      rir: set.rir ?? plannedRir
    };
  }

  /**
   * Calculates initial targets from calibration data. Used only when no previous
   * set exists (first microcycle of the first mesocycle, or brand-new exercise).
   * All subsequent microcycle progression is handled by autoregulation/forecasting.
   */
  private static calculateCalibrationBasedTargets(params: {
    exercise: WorkoutExercise;
    calibration: WorkoutExerciseCalibration;
    equipment: WorkoutEquipmentType;
    firstMicrocycleRir: number;
    repRange: { min: number; max: number };
    repRangeMidpoint: number;
  }): { targetWeight: number; targetReps: number } {
    const { exercise, calibration, equipment, firstMicrocycleRir, repRange, repRangeMidpoint } =
      params;

    // For rep progression, calculate weight based on midpoint + RIR reps
    // For load progression, use max reps
    const baseRepsForWeight =
      exercise.preferredProgressionType === ExerciseProgressionType.Rep
        ? repRangeMidpoint + firstMicrocycleRir
        : repRange.max;

    // Calculate base weight
    const rawWeight = WorkoutExerciseCalibrationService.getTargetWeight(
      calibration,
      baseRepsForWeight
    );
    const targetWeight = WorkoutEquipmentTypeService.findNearestWeight(
      equipment,
      rawWeight,
      'prefer-down'
    );
    if (targetWeight === null) {
      throw new Error(
        `No available weight options found for equipment type ${equipment._id}, ${equipment.title}`
      );
    }

    // Rep progression starts at midpoint; load progression starts at max reps
    const targetReps =
      exercise.preferredProgressionType === ExerciseProgressionType.Rep
        ? repRangeMidpoint
        : repRange.max;

    return { targetWeight, targetReps };
  }

  private static findNextTwoPercentWeight(
    currentWeight: number,
    equipment: WorkoutEquipmentType
  ): number | null {
    // Increase weight by at least 2%
    const twoPercentIncrease = currentWeight * 1.02;

    // Find the smallest weight >= 2% increase (This is purposefully done from the rounded weight
    // because the rounded weight will be what the user would have actually lifted previously)
    const nextWeight = WorkoutEquipmentTypeService.findNearestWeight(
      equipment,
      twoPercentIncrease,
      'up'
    );
    return nextWeight;
  }
}
