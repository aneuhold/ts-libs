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
});
