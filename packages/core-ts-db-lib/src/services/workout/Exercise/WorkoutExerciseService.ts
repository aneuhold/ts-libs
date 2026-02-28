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
   * Calculates the progressed target weight and reps for an exercise based on microcycle progression.
   * This returns the target weight and reps for the FIRST set of the exercise in the given microcycle,
   * assuming it is an accumulation phase (i.e., not a deload).
   *
   * This method applies either rep-based or load-based progression depending on the exercise's
   * preferred progression type, then rounds the weight to available equipment options.
   *
   * When a `previousFirstSet` is provided, autoregulation adjusts progression based on the
   * surplus between planned and actual performance. Without it, the calibration-based formula
   * is used as a baseline.
   *
   * Rep progression: The weight is calculated based on reps at microcycle 0, and reps increase
   * by 2 per microcycle to reach max reps at the final accumulation microcycle (ideally),
   * or drop back down and increase weight by 2%.
   *
   * Load progression: Increases weight by at least 2% per microcycle.
   * If weight can't be increased, adds 2 reps instead.
   */
  static calculateTargetRepsAndWeightForFirstSet(params: {
    exercise: WorkoutExercise;
    calibration: WorkoutExerciseCalibration;
    equipment: WorkoutEquipmentType;
    microcycleIndex: number;
    firstMicrocycleRir: number;
    previousFirstSet?: WorkoutSet;
  }): { targetWeight: number; targetReps: number } {
    const {
      exercise,
      calibration,
      equipment,
      microcycleIndex,
      firstMicrocycleRir,
      previousFirstSet
    } = params;

    // Validate equipment has weight options
    if (!equipment.weightOptions || equipment.weightOptions.length === 0) {
      throw new Error(
        `No weight options defined for equipment type ${equipment._id}, ${equipment.title}`
      );
    }

    // Get rep range for this exercise
    const repRange = this.getRepRangeValues(exercise.repRange);
    const repRangeMidpoint = Math.floor((repRange.min + repRange.max) / 2);

    // If we have a previous set with complete data, use autoregulation
    if (previousFirstSet && this.hasCompleteAutoRegulationData(previousFirstSet)) {
      return this.calculateAutoRegulatedTargets({
        exercise,
        equipment,
        previousFirstSet,
        repRange
      });
    }

    // Calibration-based formula (no previous set available)
    return this.calculateCalibrationBasedTargets({
      exercise,
      calibration,
      equipment,
      microcycleIndex,
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
   * Auto-regulated rep progression. Weight stays the same, reps adjust based on surplus.
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
      targetReps = repRange.max;
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
   * Checks whether a set has all the data needed for autoregulation calculations.
   */
  private static hasCompleteAutoRegulationData(set: WorkoutSet): set is CompletedWorkoutSet {
    return (
      set.actualReps != null &&
      set.plannedReps != null &&
      set.rir != null &&
      set.plannedRir != null &&
      set.plannedWeight != null
    );
  }

  /**
   * Calculates targets using the calibration-based formula (original behavior).
   */
  private static calculateCalibrationBasedTargets(params: {
    exercise: WorkoutExercise;
    calibration: WorkoutExerciseCalibration;
    equipment: WorkoutEquipmentType;
    microcycleIndex: number;
    firstMicrocycleRir: number;
    repRange: { min: number; max: number };
    repRangeMidpoint: number;
  }): { targetWeight: number; targetReps: number } {
    const {
      exercise,
      calibration,
      equipment,
      microcycleIndex,
      firstMicrocycleRir,
      repRange,
      repRangeMidpoint
    } = params;

    // For rep progression, calculate weight based on reps at microcycle 0
    // For load progression, use max reps
    let baseRepsForWeight: number;
    if (exercise.preferredProgressionType === ExerciseProgressionType.Rep) {
      baseRepsForWeight = repRangeMidpoint + firstMicrocycleRir;
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
      // Rep progression: Add up to max reps, then loop back if needed
      let currentMicrocycleIndex = 0;
      targetReps = repRangeMidpoint;

      while (currentMicrocycleIndex < microcycleIndex) {
        targetReps += 2;
        if (targetReps > repRange.max) {
          // Different reset amounts based on the rep range
          switch (exercise.repRange) {
            case ExerciseRepRange.Heavy:
              targetReps = targetReps - 4;
              break;
            case ExerciseRepRange.Medium:
              targetReps = targetReps - 6;
              break;
            case ExerciseRepRange.Light:
              targetReps = targetReps - 8;
              break;
          }
          const nextWeight = this.findNextTwoPercentWeight(targetWeight, equipment);
          if (nextWeight !== null) {
            targetWeight = nextWeight;
          }
        }
        currentMicrocycleIndex++;
      }
    } else {
      // Load progression: Start at max reps
      targetReps = repRange.max;
    }

    // Apply load progression if applicable for the weight
    if (exercise.preferredProgressionType === ExerciseProgressionType.Load && microcycleIndex > 0) {
      const nextWeight = this.findNextTwoPercentWeight(targetWeight, equipment);
      if (nextWeight !== null) {
        targetWeight = nextWeight;
      } else {
        // Increase reps if we can't increase weight
        targetReps = targetReps + 2;
      }
    }

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
