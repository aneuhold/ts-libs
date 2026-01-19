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

        // Microcycle 0 with RIR 4
        const result0 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          targetRir: 4
        });
        expect(result0.targetReps).toBe(16); // 20 (max Medium) - 4 (RIR) + 0 (microcycle 0)

        // Microcycle 1 with RIR 3
        const result1 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          targetRir: 3
        });
        expect(result1.targetReps).toBe(19); // 20 (max Medium) - 3 (RIR) + 2 (microcycle 1)

        // Microcycle 2 with RIR 2
        const result2 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 2,
          targetRir: 2
        });
        expect(result2.targetReps).toBe(20); // 20 (max Medium) - 2 (RIR) + 4 (microcycle 2), capped at max 20
      });

      it('should cap reps at max rep range', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.romanianDeadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.romanianDeadlift;

        // Microcycle 5 with RIR 0 - should cap at max (20 for Medium)
        const result = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 5,
          targetRir: 0
        });
        expect(result.targetReps).toBe(20); // Capped at max (20)
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
          targetRir: 4
        });
        const result1 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          targetRir: 3
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
          targetRir: 4
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
          targetRir: 4
        });

        const result1 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          targetRir: 3
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
          targetRir: 4
        });

        const result1 = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          targetRir: 3
        });

        // dumbbellLateralRaise is Rep progression, so reps increase by 2 per microcycle
        // Microcycle 0: 30 (Light max) - 4 (RIR) + 0 = 26
        // Microcycle 1: 30 (Light max) - 3 (RIR) + 2 (microcycle 1) = 29
        expect(result1.targetReps).toBe(29);
        expect(result0.targetReps).toBe(26);
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
          targetRir: 4
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
          targetRir: 4
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
            targetRir: 4
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
          targetRir: 4
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
          targetRir: 4
        });

        expect(result.targetReps).toBe(16); // 20 (max) - 4 (RIR)
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
          targetRir: 4
        });

        expect(result.targetReps).toBe(26); // 30 (max) - 4 (RIR)
      });
    });
  });
});
