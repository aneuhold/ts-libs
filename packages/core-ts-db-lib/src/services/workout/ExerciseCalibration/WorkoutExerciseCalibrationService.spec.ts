import { describe, expect, it } from 'vitest';
import { WorkoutExerciseCalibrationSchema } from '../../../documents/workout/WorkoutExerciseCalibration.js';
import DocumentService from '../../DocumentService.js';
import WorkoutExerciseCalibrationService from './WorkoutExerciseCalibrationService.js';

describe('Unit Tests', () => {
  describe('calculate1RM', () => {
    it('should calculate 1RM using the NASM formula', () => {
      const calibration = WorkoutExerciseCalibrationSchema.parse({
        userId: DocumentService.generateID(),
        workoutExerciseId: DocumentService.generateID(),
        weight: 100,
        reps: 8
      });

      const result = WorkoutExerciseCalibrationService.calculate1RM(calibration);

      // Formula: (100 * 8 / 30.48) + 100 = 26.247 + 100 = 126.247
      expect(result).toBeCloseTo(126.247, 2);
    });

    it('should handle single rep calibration', () => {
      const calibration = WorkoutExerciseCalibrationSchema.parse({
        userId: DocumentService.generateID(),
        workoutExerciseId: DocumentService.generateID(),
        weight: 200,
        reps: 1
      });

      const result = WorkoutExerciseCalibrationService.calculate1RM(calibration);

      // Formula: (200 * 1 / 30.48) + 200 = 6.562 + 200 = 206.562
      expect(result).toBeCloseTo(206.562, 2);
    });

    it('should handle higher rep calibration', () => {
      const calibration = WorkoutExerciseCalibrationSchema.parse({
        userId: DocumentService.generateID(),
        workoutExerciseId: DocumentService.generateID(),
        weight: 50,
        reps: 15
      });

      const result = WorkoutExerciseCalibrationService.calculate1RM(calibration);

      // Formula: (50 * 15 / 30.48) + 50 = 24.606 + 50 = 74.606
      expect(result).toBeCloseTo(74.606, 2);
    });
  });
});
