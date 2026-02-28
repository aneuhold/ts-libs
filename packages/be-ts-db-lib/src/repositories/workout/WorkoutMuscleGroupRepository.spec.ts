import { type WorkoutMuscleGroup } from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../test-util/projects/workout/workoutTestUtil.js';
import WorkoutMuscleGroupRepository from './WorkoutMuscleGroupRepository.js';

describe('WorkoutMuscleGroupRepository', () => {
  const repo = WorkoutMuscleGroupRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new muscle group', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository');

      const result = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Test Quadriceps');

      expect(result._id).toBeDefined();
      expect(result.name).toBe('Test Quadriceps');
      expect(result.userId).toBe(testUser._id);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutMuscleGroup');
    });

    it('should get all muscle groups for a user', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository');

      const muscleGroup1 = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Chest');
      const muscleGroup2 = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Back');

      const allMuscleGroups = await repo.getAllForUser(testUser._id);

      expect(allMuscleGroups.length).toBeGreaterThanOrEqual(2);
      const ids = allMuscleGroups.map((mg) => mg._id);
      expect(ids).toContain(muscleGroup1._id);
      expect(ids).toContain(muscleGroup2._id);
    });

    it('should update a muscle group', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Shoulders');

      await repo.update({
        _id: muscleGroup._id,
        name: 'Updated Shoulders'
      });

      const updated = await repo.get({ _id: muscleGroup._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated muscle group');
      }

      expect(updated.name).toBe('Updated Shoulders');
    });

    it('should delete a muscle group', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Biceps');

      await repo.delete(muscleGroup._id);

      const retrieved = await repo.get({ _id: muscleGroup._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should reject invalid muscle group on creation', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository');
      const invalidMuscleGroup = {
        userId: testUser._id
        // name is missing
      };

      await expect(
        repo.insertNew(invalidMuscleGroup as unknown as WorkoutMuscleGroup)
      ).rejects.toThrow('Schema validation failed');
    });

    it('should reject update without _id', async () => {
      await expect(
        repo.update({
          name: 'Test'
        })
      ).rejects.toThrow('No _id defined for WorkoutMuscleGroup update');
    });

    it('should reject invalid muscle group on update', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Test Group');

      const update = {
        _id: muscleGroup._id,
        name: 123 // Invalid type
      };

      await expect(repo.update(update as unknown as WorkoutMuscleGroup)).rejects.toThrow(
        'Schema validation failed'
      );
    });
  });
});
