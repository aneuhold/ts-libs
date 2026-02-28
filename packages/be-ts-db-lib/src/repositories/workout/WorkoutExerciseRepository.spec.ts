import {
  ExerciseRepRange,
  WorkoutExerciseSchema,
  type WorkoutExercise
} from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../test-util/projects/workout/workoutTestUtil.js';
import WorkoutExerciseCalibrationRepository from './WorkoutExerciseCalibrationRepository.js';
import WorkoutExerciseRepository from './WorkoutExerciseRepository.js';

describe('WorkoutExerciseRepository', () => {
  const repo = WorkoutExerciseRepository.getRepo();
  const calibrationRepo = WorkoutExerciseCalibrationRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new exercise with muscle groups and equipment', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const primaryMuscleGroup = await workoutTestUtil.insertMuscleGroup(
        testUser._id,
        'Quadriceps'
      );
      const secondaryMuscleGroup = await workoutTestUtil.insertMuscleGroup(
        testUser._id,
        'Hamstrings'
      );
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Barbell');

      const result = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: equipment._id,
        primaryMuscleGroupIds: [primaryMuscleGroup._id],
        secondaryMuscleGroupIds: [secondaryMuscleGroup._id],
        name: 'Squat',
        repRange: ExerciseRepRange.Heavy
      });

      expect(result._id).toBeDefined();
      expect(result.exerciseName).toBe('Squat');
      expect(result.userId).toBe(testUser._id);
      expect(result.primaryMuscleGroups).toHaveLength(1);
      expect(result.secondaryMuscleGroups).toHaveLength(1);
      expect(result.workoutEquipmentTypeId).toBe(equipment._id);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutExercise');
    });

    it('should insert a new exercise without secondary muscle groups', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Core');
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Bodyweight');

      const result = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: equipment._id,
        primaryMuscleGroupIds: [muscleGroup._id],
        name: 'Plank'
      });

      expect(result._id).toBeDefined();
      expect(result.exerciseName).toBe('Plank');
      expect(result.primaryMuscleGroups).toHaveLength(1);
      expect(result.secondaryMuscleGroups).toHaveLength(0);
    });

    it('should get all exercises for a user', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Chest');
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Barbell');

      const exercise1 = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: equipment._id,
        primaryMuscleGroupIds: [muscleGroup._id],
        name: 'Bench Press'
      });
      const exercise2 = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: equipment._id,
        primaryMuscleGroupIds: [muscleGroup._id],
        name: 'Incline Press'
      });

      const allExercises = await repo.getAllForUser(testUser._id);

      expect(allExercises.length).toBeGreaterThanOrEqual(2);
      const ids = allExercises.map((ex) => ex._id);
      expect(ids).toContain(exercise1._id);
      expect(ids).toContain(exercise2._id);
    });

    it('should update an exercise', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Back');
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Bodyweight');

      const exercise = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: equipment._id,
        primaryMuscleGroupIds: [muscleGroup._id],
        name: 'Pull Up'
      });

      await repo.update({
        _id: exercise._id,
        exerciseName: 'Weighted Pull Up'
      });

      const updated = await repo.get({ _id: exercise._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated exercise');
      }

      expect(updated.exerciseName).toBe('Weighted Pull Up');
    });

    it('should delete an exercise', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Shoulders');
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Barbell');

      const exercise = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: equipment._id,
        primaryMuscleGroupIds: [muscleGroup._id],
        name: 'Overhead Press'
      });

      await repo.delete(exercise._id);

      const retrieved = await repo.get({ _id: exercise._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should reject exercise with non-existent muscle group', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Barbell');

      const newExercise = WorkoutExerciseSchema.parse({
        userId: testUser._id,
        exerciseName: 'Invalid Exercise',
        workoutEquipmentTypeId: equipment._id,
        initialFatigueGuess: {},
        primaryMuscleGroups: [
          '00000000-0000-7000-8000-000000000000' as `${string}-${string}-${string}-${string}-${string}`
        ],
        repRange: ExerciseRepRange.Medium
      });

      await expect(repo.insertNew(newExercise)).rejects.toThrow(
        'Not all muscle groups exist. Found: 0, expected: 1'
      );
    });

    it('should reject exercise with non-existent equipment type', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Legs');

      const fakeEquipmentId = '00000000-0000-7000-8000-000000000000';
      const newExercise = WorkoutExerciseSchema.parse({
        userId: testUser._id,
        exerciseName: 'Invalid Exercise',
        workoutEquipmentTypeId: fakeEquipmentId,
        initialFatigueGuess: {},
        primaryMuscleGroups: [muscleGroup._id],
        repRange: ExerciseRepRange.Medium
      });

      await expect(repo.insertNew(newExercise)).rejects.toThrow(
        `Equipment type with ID ${fakeEquipmentId} does not exist`
      );
    });

    it('should reject invalid exercise on creation', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');

      const invalidExercise = {
        userId: testUser._id
        // exerciseName, workoutEquipmentTypeId, and repRange are missing
      };

      await expect(repo.insertNew(invalidExercise as unknown as WorkoutExercise)).rejects.toThrow(
        'Schema validation failed'
      );
    });

    it('should reject update without _id', async () => {
      await expect(
        repo.update({
          exerciseName: 'Test'
        })
      ).rejects.toThrow('No _id defined for WorkoutExercise update');
    });
  });

  describe('Cascading Deletes', () => {
    it('should delete calibrations when exercise is deleted', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Arms');
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Dumbbell');

      const exercise = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: equipment._id,
        primaryMuscleGroupIds: [muscleGroup._id],
        name: 'Bicep Curl'
      });

      const calibration = await workoutTestUtil.insertCalibration({
        userId: testUser._id,
        exerciseId: exercise._id,
        reps: 10,
        weight: 25
      });

      // Verify calibration exists
      const retrievedCalibration = await calibrationRepo.get({ _id: calibration._id });
      expect(retrievedCalibration).toBeTruthy();

      // Delete the exercise
      await repo.delete(exercise._id);

      // Verify calibration is also deleted
      const deletedCalibration = await calibrationRepo.get({ _id: calibration._id });
      expect(deletedCalibration).toBeNull();
    });
  });
});
