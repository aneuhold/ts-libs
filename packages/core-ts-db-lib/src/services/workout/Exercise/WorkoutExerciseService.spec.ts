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
      it('should increase reps by 2 per microcycle for rep progression', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.romanianDeadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.romanianDeadlift;

        // With 5 accumulation microcycles:
        // Final microcycle (index 4): 20 (max) reps
        // Microcycle 0: 20 - 4*2 = 12 base reps
        // Microcycle 1: 20 - 3*2 = 14 base reps
        // Microcycle 2: 20 - 2*2 = 16 base reps

        // Microcycle 0 with RIR 4
        const result0 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          targetRir: 4,
          totalAccumulationMicrocycles: 5
        });
        expect(result0.targetReps).toBe(8); // 12 (base) - 4 (RIR)

        // Microcycle 1 with RIR 3
        const result1 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          targetRir: 3,
          totalAccumulationMicrocycles: 5
        });
        expect(result1.targetReps).toBe(11); // 14 (base) - 3 (RIR)

        // Microcycle 2 with RIR 2
        const result2 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 2,
          targetRir: 2,
          totalAccumulationMicrocycles: 5
        });
        expect(result2.targetReps).toBe(14); // 16 (base) - 2 (RIR)
      });

      it('should reach max reps at final accumulation microcycle', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.romanianDeadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.romanianDeadlift;

        // Microcycle 4 (final accumulation) with RIR 0 - should be at max (20 for Medium)
        const result = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 4,
          targetRir: 0,
          totalAccumulationMicrocycles: 5
        });
        expect(result.targetReps).toBe(20); // 20 (base at final microcycle) - 0 (RIR)
      });

      it('should not change weight for rep progression', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.romanianDeadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.romanianDeadlift;

        const result0 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          targetRir: 4,
          totalAccumulationMicrocycles: 5
        });
        const result1 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          targetRir: 3,
          totalAccumulationMicrocycles: 5
        });

        expect(result0.targetWeight).toBe(result1.targetWeight);
      });
    });

    describe('Load Progression', () => {
      it('should not increase weight in microcycle 0', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const result = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          targetRir: 4,
          totalAccumulationMicrocycles: 5
        });

        expect(result.targetReps).toBe(11); // 15 (Heavy max) - 4
        // Weight should be based on calibration, not increased
        expect(result.targetWeight).toBeGreaterThan(0);
      });

      it('should increase weight by at least 2% in subsequent microcycles', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const result0 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          targetRir: 4,
          totalAccumulationMicrocycles: 5
        });

        const result1 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          targetRir: 3,
          totalAccumulationMicrocycles: 5
        });

        // Weight should increase by at least 2%
        expect(result1.targetWeight).toBeGreaterThanOrEqual(result0.targetWeight * 1.02);
      });

      it('should increase reps when max weight is reached', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise;

        const result0 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          targetRir: 4,
          totalAccumulationMicrocycles: 5
        });

        const result1 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          targetRir: 3,
          totalAccumulationMicrocycles: 5
        });

        // dumbbellLateralRaise is Rep progression, backward calculation:
        // Final (index 4): 30 (Light max) reps
        // Microcycle 0: 30 - 4*2 = 22 base reps
        // Microcycle 1: 30 - 3*2 = 24 base reps
        // Microcycle 0: 22 - 4 (RIR) = 18
        // Microcycle 1: 24 - 3 (RIR) = 21
        expect(result0.targetReps).toBe(18);
        expect(result1.targetReps).toBe(21);
      });
    });

    describe('Weight Rounding', () => {
      it('should round down to nearest available weight', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const result = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          targetRir: 4,
          totalAccumulationMicrocycles: 5
        });

        // Should be an available weight option
        expect(equipment.weightOptions).toContain(result.targetWeight);
      });

      it('should round up if no lower weight is available', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise;

        const result = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          targetRir: 4,
          totalAccumulationMicrocycles: 5
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
          WorkoutExerciseService.calculateProgressedTargets({
            exercise,
            calibration,
            equipment,
            microcycleIndex: 0,
            targetRir: 4,
            totalAccumulationMicrocycles: 5
          })
        ).toThrow('No weight options defined');
      });
    });

    describe('Different Rep Ranges', () => {
      it('should work with Heavy rep range (5-15)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const result = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          targetRir: 4,
          totalAccumulationMicrocycles: 5
        });

        expect(result.targetReps).toBe(11); // 15 (max) - 4 (RIR)
      });

      it('should work with Medium rep range (10-20)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.romanianDeadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.romanianDeadlift;

        const result = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          targetRir: 4,
          totalAccumulationMicrocycles: 5
        });

        // Backward calculation: 20 - 4*2 = 12 base, 12 - 4 (RIR) = 8
        expect(result.targetReps).toBe(8);
      });

      it('should work with Light rep range (15-30)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise;

        const result = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          targetRir: 4,
          totalAccumulationMicrocycles: 5
        });

        // Backward calculation: 30 - 4*2 = 22 base, 22 - 4 (RIR) = 18
        expect(result.targetReps).toBe(18);
      });
    });
  });
});
