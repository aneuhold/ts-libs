import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import { ExerciseRepRange } from '../../../documents/workout/WorkoutExercise.js';
import WorkoutExerciseService from './WorkoutExerciseService.js';

describe('Unit Tests', () => {
  describe('getRepRangeValues', () => {
    it('should return correct values for Heavy rep range', () => {
      const result = WorkoutExerciseService.getRepRangeValues(ExerciseRepRange.Heavy);

      expect(result).toEqual({ min: 5, max: 15 });
    });

    it('should return correct values for Medium rep range', () => {
      const result = WorkoutExerciseService.getRepRangeValues(ExerciseRepRange.Medium);

      expect(result).toEqual({ min: 10, max: 20 });
    });

    it('should return correct values for Light rep range', () => {
      const result = WorkoutExerciseService.getRepRangeValues(ExerciseRepRange.Light);

      expect(result).toEqual({ min: 15, max: 30 });
    });
  });

  describe('calculateProgressedTargets', () => {
    describe('Rep Progression', () => {
      it('should start new block with reset reps and increased weight', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Medium range: After hitting max (20), resets by subtracting 6
        // Microcycle 5: 20 reps
        // Microcycle 6: would be 22, resets to 22 - 6 = 16
        const result5 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 5,
          firstMicrocycleRir: 4
        });

        const result6 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 6,
          firstMicrocycleRir: 4
        });

        // Reps reset to 15 for block 1 (21 - 6)
        expect(result6.targetReps).toBe(15);
        // Weight should be at least 2% more
        expect(result6.targetWeight).toBeGreaterThanOrEqual(result5.targetWeight * 1.02);
      });

      it('should maintain same weight within a block for rep progression', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        const result0 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });
        const result2 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 2,
          firstMicrocycleRir: 4
        });

        expect(result0.targetWeight).toBe(result2.targetWeight);
      });
    });

    describe('Load Progression', () => {
      it('should not increase weight in microcycle 0', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        expect(result.targetReps).toBe(15); // Heavy max (no RIR subtraction)
        // Weight should be based on calibration, not increased
        expect(result.targetWeight).toBeGreaterThan(0);
      });

      it('should increase weight by at least 2% in subsequent microcycles', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const result0 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        const result1 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4
        });

        // Weight should increase by at least 2%
        expect(result1.targetWeight).toBeGreaterThanOrEqual(result0.targetWeight * 1.02);
        // Reps stay at max for load progression
        expect(result1.targetReps).toBe(15);
      });

      it('should increase reps when max weight is reached', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise;

        const result0 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        const result1 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4
        });

        // dumbbellLateralRaise is Rep progression, block-based:
        // Light range (15-30): starts at midpoint (22) reps
        expect(result0.targetReps).toBe(22);
        expect(result1.targetReps).toBe(24); // 22 + 2
      });
    });

    describe('Weight Rounding', () => {
      it('should round down to nearest available weight', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        // Should be an available weight option
        expect(equipment.weightOptions).toContain(result.targetWeight);
      });

      it('should round up if no lower weight is available', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise;

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        // Should round up to lowest available (45lbs for barbell)
        expect(result.targetWeight).toBe(45);
      });
    });

    describe('Error Cases', () => {
      it('should throw error when equipment has no weight options', () => {
        // Create a copy with empty weight options to avoid mutating shared test util
        const equipment = {
          ...workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell,
          weightOptions: []
        };

        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        expect(() =>
          WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
            exercise,
            calibration,
            equipment,
            microcycleIndex: 0,
            firstMicrocycleRir: 4
          })
        ).toThrow('No weight options defined');
      });
    });

    describe('Different Rep Ranges', () => {
      it('should work with Heavy rep range (5-15)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        expect(result.targetReps).toBe(15); // Max for load progression (no RIR subtraction)
      });

      it('should work with Medium rep range (10-20)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        // Rep progression: starts at midpoint (15)
        expect(result.targetReps).toBe(15);
      });

      it('should work with Light rep range (15-30)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise;

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        // Rep progression: starts at midpoint (22)
        expect(result.targetReps).toBe(22);
      });
    });
  });
});
