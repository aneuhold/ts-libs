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

      // 1RM = 126.247, target% = 41%, calculated = 51.76
      expect(result).toBeCloseTo(51.76, 1);
    });

    it('should handle different rep targets', () => {
      const calibration = workoutTestUtil.createCalibration({
        weight: 100,
        reps: 8
      });

      const result15Reps = WorkoutExerciseCalibrationService.getTargetWeight(calibration, 15);
      const result5Reps = WorkoutExerciseCalibrationService.getTargetWeight(calibration, 5);

      // 15 reps: 1RM = 126.247, target% = 52%, calculated = 65.65
      expect(result15Reps).toBeCloseTo(65.65, 1);
      // 5 reps: 1RM = 126.247, target% = 30%, calculated = 37.87
      expect(result5Reps).toBeCloseTo(37.87, 1);
    });
  });
});
