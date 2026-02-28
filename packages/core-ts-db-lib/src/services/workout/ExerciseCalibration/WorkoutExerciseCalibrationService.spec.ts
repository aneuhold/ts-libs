import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import WorkoutExerciseCalibrationService from './WorkoutExerciseCalibrationService.js';

describe('Unit Tests', () => {
  describe('get1RM', () => {
    it('should calculate 1RM using the NASM formula', () => {
      const calibration = workoutTestUtil.createCalibration({
        weight: 100,
        reps: 8
      });

      const result = WorkoutExerciseCalibrationService.get1RM(calibration);

      // Formula: (100 * 8 / 30.48) + 100 = 26.247 + 100 = 126.247
      expect(result).toBeCloseTo(126.247, 2);
    });

    it('should handle single rep calibration', () => {
      const calibration = workoutTestUtil.createCalibration({
        weight: 200,
        reps: 1
      });

      const result = WorkoutExerciseCalibrationService.get1RM(calibration);

      // Formula: (200 * 1 / 30.48) + 200 = 6.562 + 200 = 206.562
      expect(result).toBeCloseTo(206.562, 2);
    });

    it('should handle higher rep calibration', () => {
      const calibration = workoutTestUtil.createCalibration({
        weight: 50,
        reps: 15
      });

      const result = WorkoutExerciseCalibrationService.get1RM(calibration);

      // Formula: (50 * 15 / 30.48) + 50 = 24.606 + 50 = 74.606
      expect(result).toBeCloseTo(74.606, 2);
    });
  });

  describe('getTargetWeight', () => {
    it('should calculate target weight without rounding', () => {
      const calibration = workoutTestUtil.createCalibration({
        weight: 100,
        reps: 8
      });

      const result = WorkoutExerciseCalibrationService.getTargetWeight(calibration, 10);

      // 1RM = 126.247, target% = 85 - ((10-5)*2.2) = 74%, calculated = 93.42
      expect(result).toBeCloseTo(93.42, 1);
    });

    it('should handle different rep targets', () => {
      const calibration = workoutTestUtil.createCalibration({
        weight: 100,
        reps: 8
      });

      const result15Reps = WorkoutExerciseCalibrationService.getTargetWeight(calibration, 15);
      const result5Reps = WorkoutExerciseCalibrationService.getTargetWeight(calibration, 5);

      // 15 reps: 1RM = 126.247, target% = 85 - ((15-5)*2.2) = 63%, calculated = 79.54
      expect(result15Reps).toBeCloseTo(79.54, 1);
      // 5 reps: 1RM = 126.247, target% = 85%, calculated = 107.31
      expect(result5Reps).toBeCloseTo(107.31, 1);
    });

    it('should produce lower target weight for higher rep counts', () => {
      const calibration = workoutTestUtil.createCalibration({
        weight: 25,
        reps: 10
      });

      const weightFor10Reps = WorkoutExerciseCalibrationService.getTargetWeight(calibration, 10);
      const weightFor20Reps = WorkoutExerciseCalibrationService.getTargetWeight(calibration, 20);
      const weightFor26Reps = WorkoutExerciseCalibrationService.getTargetWeight(calibration, 26);

      // Higher rep targets should produce lower weights (need less % of 1RM)
      expect(weightFor20Reps).toBeLessThan(weightFor10Reps);
      expect(weightFor26Reps).toBeLessThan(weightFor20Reps);
    });

    it('should produce a weight close to calibration weight at calibration reps', () => {
      const calibration = workoutTestUtil.createCalibration({
        weight: 25,
        reps: 10
      });

      const targetWeight = WorkoutExerciseCalibrationService.getTargetWeight(calibration, 10);

      // If calibrated at 25lb x 10 reps, the target weight for 10 reps should
      // be close to 25lb (not drastically different)
      expect(targetWeight).toBeGreaterThan(20);
      expect(targetWeight).toBeLessThan(30);
    });
  });

  describe('getTargetWeightFrom1RM', () => {
    it('should calculate target weight from a raw 1RM value', () => {
      // 1RM = 126.247, target% for 10 reps = 85 - ((10-5)*2.2) = 74%
      const result = WorkoutExerciseCalibrationService.getTargetWeightFrom1RM(126.247, 10);

      expect(result).toBeCloseTo(93.42, 1);
    });

    it('should produce the same result as getTargetWeight for the same 1RM', () => {
      const calibration = workoutTestUtil.createCalibration({
        weight: 100,
        reps: 8
      });
      const oneRM = WorkoutExerciseCalibrationService.get1RM(calibration);

      const fromCalibration = WorkoutExerciseCalibrationService.getTargetWeight(calibration, 15);
      const from1RM = WorkoutExerciseCalibrationService.getTargetWeightFrom1RM(oneRM, 15);

      expect(from1RM).toBeCloseTo(fromCalibration, 5);
    });

    it('should produce lower target weight for higher rep counts', () => {
      const oneRM = 200;

      const weightFor5 = WorkoutExerciseCalibrationService.getTargetWeightFrom1RM(oneRM, 5);
      const weightFor15 = WorkoutExerciseCalibrationService.getTargetWeightFrom1RM(oneRM, 15);
      const weightFor25 = WorkoutExerciseCalibrationService.getTargetWeightFrom1RM(oneRM, 25);

      expect(weightFor15).toBeLessThan(weightFor5);
      expect(weightFor25).toBeLessThan(weightFor15);
    });
  });

  describe('generateAutoCalibrations', () => {
    const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress;
    const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress;
    const equipmentType = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
    const dateRecorded = new Date(2024, 5, 15);

    it('should create a calibration when bestSet 1RM exceeds bestCalibration 1RM', () => {
      // Calibration: 135lb x 10 reps → 1RM ≈ 179.29
      // Best set: 200lb x 5 reps → 1RM ≈ 232.81
      const bestSet = workoutTestUtil.createSet({
        exercise,
        overrides: { actualWeight: 200, actualReps: 5 }
      });
      const cto = workoutTestUtil.createExerciseCTO({
        exercise,
        calibration,
        equipmentType,
        bestSet
      });

      const result = WorkoutExerciseCalibrationService.generateAutoCalibrations(
        [cto],
        workoutTestUtil.userId,
        dateRecorded
      );

      expect(result).toHaveLength(1);
      expect(result[0].weight).toBe(200);
      expect(result[0].reps).toBe(5);
      expect(result[0].associatedWorkoutSetId).toBe(bestSet._id);
      expect(result[0].workoutExerciseId).toBe(exercise._id);
      expect(result[0].dateRecorded).toEqual(dateRecorded);
    });

    it('should not create a calibration when bestSet 1RM is below bestCalibration 1RM', () => {
      // Calibration: 135lb x 10 reps → 1RM ≈ 179.29
      // Best set: 100lb x 5 reps → 1RM ≈ 116.40
      const bestSet = workoutTestUtil.createSet({
        exercise,
        overrides: { actualWeight: 100, actualReps: 5 }
      });
      const cto = workoutTestUtil.createExerciseCTO({
        exercise,
        calibration,
        equipmentType,
        bestSet
      });

      const result = WorkoutExerciseCalibrationService.generateAutoCalibrations(
        [cto],
        workoutTestUtil.userId,
        dateRecorded
      );

      expect(result).toHaveLength(0);
    });

    it('should create a calibration when no bestCalibration exists', () => {
      const bestSet = workoutTestUtil.createSet({
        exercise,
        overrides: { actualWeight: 100, actualReps: 8 }
      });
      const cto = workoutTestUtil.createExerciseCTO({
        exercise,
        calibration: null,
        equipmentType,
        bestSet
      });

      const result = WorkoutExerciseCalibrationService.generateAutoCalibrations(
        [cto],
        workoutTestUtil.userId,
        dateRecorded
      );

      expect(result).toHaveLength(1);
      expect(result[0].weight).toBe(100);
      expect(result[0].reps).toBe(8);
      expect(result[0].associatedWorkoutSetId).toBe(bestSet._id);
    });

    it('should skip CTOs with null bestSet', () => {
      const cto = workoutTestUtil.createExerciseCTO({
        exercise,
        calibration,
        equipmentType,
        bestSet: null
      });

      const result = WorkoutExerciseCalibrationService.generateAutoCalibrations(
        [cto],
        workoutTestUtil.userId,
        dateRecorded
      );

      expect(result).toHaveLength(0);
    });

    it('should skip CTOs where bestSet has zero reps', () => {
      const bestSet = workoutTestUtil.createSet({
        exercise,
        overrides: { actualWeight: 100, actualReps: 0 }
      });
      const cto = workoutTestUtil.createExerciseCTO({
        exercise,
        calibration: null,
        equipmentType,
        bestSet
      });

      const result = WorkoutExerciseCalibrationService.generateAutoCalibrations(
        [cto],
        workoutTestUtil.userId,
        dateRecorded
      );

      expect(result).toHaveLength(0);
    });

    it('should handle multiple exercises independently', () => {
      const exercise2 = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
      const equipmentType2 = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;

      const benchSet = workoutTestUtil.createSet({
        exercise,
        overrides: { actualWeight: 200, actualReps: 5 }
      });
      const squatSet = workoutTestUtil.createSet({
        exercise: exercise2,
        overrides: { actualWeight: 300, actualReps: 5 }
      });

      const benchCTO = workoutTestUtil.createExerciseCTO({
        exercise,
        calibration: null,
        equipmentType,
        bestSet: benchSet
      });
      const squatCTO = workoutTestUtil.createExerciseCTO({
        exercise: exercise2,
        calibration: null,
        equipmentType: equipmentType2,
        bestSet: squatSet
      });

      const result = WorkoutExerciseCalibrationService.generateAutoCalibrations(
        [benchCTO, squatCTO],
        workoutTestUtil.userId,
        dateRecorded
      );

      expect(result).toHaveLength(2);
      const benchCal = result.find((c) => c.workoutExerciseId === exercise._id);
      const squatCal = result.find((c) => c.workoutExerciseId === exercise2._id);
      expect(benchCal?.weight).toBe(200);
      expect(squatCal?.weight).toBe(300);
    });
  });
});
