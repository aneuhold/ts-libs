import {
  UserSchema,
  WorkoutMuscleGroupSchema,
  type WorkoutMuscleGroup
} from '@aneuhold/core-ts-db-lib';
import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { cleanupDoc, getTestUserName } from '../../../test-util/testsUtil.js';
import UserRepository from '../common/UserRepository.js';
import WorkoutMuscleGroupRepository from './WorkoutMuscleGroupRepository.js';

const userRepo = UserRepository.getRepo();

describe('WorkoutMuscleGroupRepository', () => {
  const repo = WorkoutMuscleGroupRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new muscle group', async () => {
      const testUser = await createNewTestUser();
      const newMuscleGroup = WorkoutMuscleGroupSchema.parse({
        userId: testUser._id,
        name: 'Test Quadriceps'
      });

      const result = await repo.insertNew(newMuscleGroup);
      if (!result) {
        throw new Error('Failed to insert muscle group');
      }

      expect(result._id).toBeDefined();
      expect(result.name).toBe('Test Quadriceps');
      expect(result.userId).toBe(testUser._id);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutMuscleGroup');

      // Cleanup
      await repo.delete(result._id);
      await cleanupDoc(userRepo, testUser);
    });

    it('should get all muscle groups for a user', async () => {
      const testUser = await createNewTestUser();
      const muscleGroup1 = await repo.insertNew(
        WorkoutMuscleGroupSchema.parse({
          userId: testUser._id,
          name: 'Chest'
        })
      );

      const muscleGroup2 = await repo.insertNew(
        WorkoutMuscleGroupSchema.parse({
          userId: testUser._id,
          name: 'Back'
        })
      );

      if (!muscleGroup1 || !muscleGroup2) {
        throw new Error('Failed to insert muscle groups');
      }

      const allMuscleGroups = await repo.getAllForUser(testUser._id);

      expect(allMuscleGroups.length).toBeGreaterThanOrEqual(2);
      const ids = allMuscleGroups.map((mg) => mg._id);
      expect(ids).toContain(muscleGroup1._id);
      expect(ids).toContain(muscleGroup2._id);

      // Cleanup
      await repo.delete(muscleGroup1._id);
      await repo.delete(muscleGroup2._id);
      await cleanupDoc(userRepo, testUser);
    });

    it('should update a muscle group', async () => {
      const testUser = await createNewTestUser();
      const muscleGroup = await repo.insertNew(
        WorkoutMuscleGroupSchema.parse({
          userId: testUser._id,
          name: 'Shoulders'
        })
      );

      if (!muscleGroup) {
        throw new Error('Failed to insert muscle group');
      }

      await repo.update({
        _id: muscleGroup._id,
        name: 'Updated Shoulders'
      });

      const updated = await repo.get({ _id: muscleGroup._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated muscle group');
      }

      expect(updated.name).toBe('Updated Shoulders');

      // Cleanup
      await repo.delete(muscleGroup._id);
      await cleanupDoc(userRepo, testUser);
    });

    it('should delete a muscle group', async () => {
      const testUser = await createNewTestUser();
      const muscleGroup = await repo.insertNew(
        WorkoutMuscleGroupSchema.parse({
          userId: testUser._id,
          name: 'Biceps'
        })
      );

      if (!muscleGroup) {
        throw new Error('Failed to insert muscle group');
      }

      await repo.delete(muscleGroup._id);

      const retrieved = await repo.get({ _id: muscleGroup._id });
      expect(retrieved).toBeNull();
      await cleanupDoc(userRepo, testUser);
    });
  });

  describe('Validation', () => {
    it('should reject invalid muscle group on creation', async () => {
      const testUser = await createNewTestUser();
      // Test with missing required field (name)
      const invalidMuscleGroup = {
        userId: testUser._id
        // name is missing
      };

      await expect(
        repo.insertNew(invalidMuscleGroup as unknown as WorkoutMuscleGroup)
      ).rejects.toThrow('Schema validation failed');
      await cleanupDoc(userRepo, testUser);
    });

    it('should reject update without _id', async () => {
      await expect(
        repo.update({
          name: 'Test'
        })
      ).rejects.toThrow('No _id defined for WorkoutMuscleGroup update');
    });

    it('should reject invalid muscle group on update', async () => {
      const testUser = await createNewTestUser();
      const muscleGroup = await repo.insertNew(
        WorkoutMuscleGroupSchema.parse({
          userId: testUser._id,
          name: 'Test Group'
        })
      );

      if (!muscleGroup) {
        throw new Error('Failed to insert muscle group');
      }

      // Create the update
      const update = {
        _id: muscleGroup._id,
        name: 123 // Invalid type
      };

      // Test with invalid data type for name
      await expect(repo.update(update as unknown as WorkoutMuscleGroup)).rejects.toThrow(
        'Schema validation failed'
      );

      // Cleanup
      await repo.delete(muscleGroup._id);
      await cleanupDoc(userRepo, testUser);
    });
  });
});

/**
 * Create a new test user
 *
 * @returns The new user
 */
async function createNewTestUser() {
  const newUser = UserSchema.parse({
    userName: getTestUserName(`${crypto.randomUUID()}musclegroup`)
  });
  const insertResult = await userRepo.insertNew(newUser);
  expect(insertResult).toBeTruthy();
  return newUser;
}
