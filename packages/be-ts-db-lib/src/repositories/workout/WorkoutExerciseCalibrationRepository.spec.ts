import {
  ExerciseRepRange,
  WorkoutExerciseCalibrationSchema,
  type WorkoutExerciseCalibration
} from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../test-util/projects/workout/workoutTestUtil.js';
import WorkoutExerciseCalibrationRepository from './WorkoutExerciseCalibrationRepository.js';
import WorkoutExerciseRepository from './WorkoutExerciseRepository.js';

describe('WorkoutExerciseCalibrationRepository', () => {
  const repo = WorkoutExerciseCalibrationRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new calibration', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseCalibrationRepository');
      const mg = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Chest');
      const eq = await workoutTestUtil.insertEquipmentType(testUser._id, 'Barbell');
      const exercise = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Bench Press'
      });

      const result = await workoutTestUtil.insertCalibration({
        userId: testUser._id,
        exerciseId: exercise._id,
        reps: 10,
        weight: 135
      });

      expect(result._id).toBeDefined();
      expect(result.workoutExerciseId).toBe(exercise._id);
      expect(result.reps).toBe(10);
      expect(result.weight).toBe(135);
      expect(result.userId).toBe(testUser._id);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutExerciseCalibration');
    });

    it('should get all calibrations for a user', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseCalibrationRepository');
      const mg = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Legs');
      const eq = await workoutTestUtil.insertEquipmentType(testUser._id, 'Barbell');
      const exercise = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Squat',
        repRange: ExerciseRepRange.Heavy
      });

      const calibration1 = await workoutTestUtil.insertCalibration({
        userId: testUser._id,
        exerciseId: exercise._id,
        reps: 5,
        weight: 225
      });
      const calibration2 = await workoutTestUtil.insertCalibration({
        userId: testUser._id,
        exerciseId: exercise._id,
        reps: 8,
        weight: 185
      });

      const allCalibrations = await repo.getAllForUser(testUser._id);

      expect(allCalibrations.length).toBeGreaterThanOrEqual(2);
      const ids = allCalibrations.map((cal) => cal._id);
      expect(ids).toContain(calibration1._id);
      expect(ids).toContain(calibration2._id);
    });

    it('should update a calibration', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseCalibrationRepository');
      const mg = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Back');
      const eq = await workoutTestUtil.insertEquipmentType(testUser._id, 'Barbell');
      const exercise = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Deadlift',
        repRange: ExerciseRepRange.Heavy
      });

      const calibration = await workoutTestUtil.insertCalibration({
        userId: testUser._id,
        exerciseId: exercise._id,
        reps: 5,
        weight: 315
      });

      await repo.update({
        _id: calibration._id,
        weight: 335
      });

      const updated = await repo.get({ _id: calibration._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated calibration');
      }

      expect(updated.weight).toBe(335);
    });

    it('should delete a calibration', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseCalibrationRepository');
      const mg = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Shoulders');
      const eq = await workoutTestUtil.insertEquipmentType(testUser._id, 'Barbell');
      const exercise = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Overhead Press'
      });

      const calibration = await workoutTestUtil.insertCalibration({
        userId: testUser._id,
        exerciseId: exercise._id,
        reps: 10,
        weight: 95
      });

      await repo.delete(calibration._id);

      const retrieved = await repo.get({ _id: calibration._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should reject calibration with non-existent exercise', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseCalibrationRepository');

      const fakeExerciseId = '00000000-0000-7000-8000-000000000000';
      const newCalibration = WorkoutExerciseCalibrationSchema.parse({
        userId: testUser._id,
        workoutExerciseId: fakeExerciseId,
        reps: 10,
        weight: 100
      });

      await expect(repo.insertNew(newCalibration)).rejects.toThrow(
        `Exercise with ID ${fakeExerciseId} does not exist`
      );
    });

    it('should reject invalid calibration on creation', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseCalibrationRepository');

      const invalidCalibration = {
        userId: testUser._id
        // workoutExerciseId, reps, and weight are missing
      };

      await expect(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        repo.insertNew(invalidCalibration as unknown as WorkoutExerciseCalibration)
      ).rejects.toThrow('Schema validation failed');
    });

    it('should reject update without _id', async () => {
      await expect(
        repo.update({
          weight: 200
        })
      ).rejects.toThrow('No _id defined for WorkoutExerciseCalibration update');
    });

    it('should reject update with non-existent exercise', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseCalibrationRepository');
      const mg = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Arms');
      const eq = await workoutTestUtil.insertEquipmentType(testUser._id, 'Dumbbell');
      const exercise = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Bicep Curl'
      });

      const calibration = await workoutTestUtil.insertCalibration({
        userId: testUser._id,
        exerciseId: exercise._id,
        reps: 10,
        weight: 30
      });

      const fakeExerciseId = '00000000-0000-7000-8000-000000000000';
      await expect(
        repo.update({
          _id: calibration._id,
          workoutExerciseId: fakeExerciseId
        })
      ).rejects.toThrow(`Exercise with ID ${fakeExerciseId} does not exist`);
    });
  });

  describe('Exercise Reference', () => {
    it('should maintain calibration when exercise is updated', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseCalibrationRepository');
      const mg = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Core');
      const eq = await workoutTestUtil.insertEquipmentType(testUser._id, 'Bodyweight');
      const exercise = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Plank'
      });

      const calibration = await workoutTestUtil.insertCalibration({
        userId: testUser._id,
        exerciseId: exercise._id,
        reps: 1,
        weight: 0
      });

      // Update exercise
      await WorkoutExerciseRepository.getRepo().update({
        _id: exercise._id,
        exerciseName: 'Weighted Plank'
      });

      // Verify calibration still exists
      const retrievedCalibration = await repo.get({ _id: calibration._id });
      expect(retrievedCalibration).toBeTruthy();
      if (!retrievedCalibration) {
        throw new Error('Calibration should still exist');
      }
      expect(retrievedCalibration.workoutExerciseId).toBe(exercise._id);
    });
  });
});
