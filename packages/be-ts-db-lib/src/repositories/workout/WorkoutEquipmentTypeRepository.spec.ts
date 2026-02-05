import {
  UserSchema,
  WorkoutEquipmentTypeSchema,
  type WorkoutEquipmentType
} from '@aneuhold/core-ts-db-lib';
import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { getTestUserName } from '../../../test-util/testsUtil.js';
import UserRepository from '../common/UserRepository.js';
import WorkoutEquipmentTypeRepository from './WorkoutEquipmentTypeRepository.js';

const userRepo = UserRepository.getRepo();

describe('WorkoutEquipmentTypeRepository', () => {
  const repo = WorkoutEquipmentTypeRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new equipment type with weight options', async () => {
      const testUser = await createNewTestUser();
      const newEquipment = WorkoutEquipmentTypeSchema.parse({
        userId: testUser._id,
        title: 'Barbell',
        weightOptions: [45, 55, 65, 75, 85]
      });

      const result = await repo.insertNew(newEquipment);
      if (!result) {
        throw new Error('Failed to insert equipment');
      }

      expect(result._id).toBeDefined();
      expect(result.title).toBe('Barbell');
      expect(result.weightOptions).toEqual([45, 55, 65, 75, 85]);
      expect(result.docType).toBe('workoutEquipmentType');

      // Cleanup
      await repo.delete(result._id);
    });

    it('should insert equipment type without weight options', async () => {
      const testUser = await createNewTestUser();
      const newEquipment = WorkoutEquipmentTypeSchema.parse({
        userId: testUser._id,
        title: 'Bodyweight'
      });

      const result = await repo.insertNew(newEquipment);
      if (!result) {
        throw new Error('Failed to insert equipment');
      }

      expect(result.weightOptions).toBeUndefined();

      // Cleanup
      await repo.delete(result._id);
    });

    it('should update equipment type and modify weight options', async () => {
      const testUser = await createNewTestUser();
      const equipment = await repo.insertNew(
        WorkoutEquipmentTypeSchema.parse({
          userId: testUser._id,
          title: 'Dumbbell',
          weightOptions: [10, 20, 30]
        })
      );

      if (!equipment) {
        throw new Error('Failed to insert equipment');
      }

      await repo.update({
        _id: equipment._id,
        weightOptions: [10, 15, 20, 25, 30]
      });

      const updated = await repo.get({ _id: equipment._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated equipment');
      }

      expect(updated.weightOptions).toEqual([10, 15, 20, 25, 30]);

      // Cleanup
      await repo.delete(equipment._id);
    });
  });

  describe('Validation', () => {
    it('should reject invalid equipment type on creation', async () => {
      const testUser = await createNewTestUser();
      // Test with missing required field (title)
      const invalidEquipment = {
        userId: testUser._id
        // title is missing
      };

      await expect(
        repo.insertNew(invalidEquipment as unknown as WorkoutEquipmentType)
      ).rejects.toThrow('Schema validation failed');
    });

    it('should reject update without _id', async () => {
      await expect(
        repo.update({
          title: 'Test'
        })
      ).rejects.toThrow('No _id defined for WorkoutEquipmentType update');
    });

    it('should reject invalid equipment type on update', async () => {
      const testUser = await createNewTestUser();
      const equipment = await repo.insertNew(
        WorkoutEquipmentTypeSchema.parse({
          userId: testUser._id,
          title: 'Test Equipment'
        })
      );

      if (!equipment) {
        throw new Error('Failed to insert equipment');
      }

      // Test with invalid data type for title
      await expect(
        repo.update({
          _id: equipment._id,
          title: 123
        } as unknown as WorkoutEquipmentType)
      ).rejects.toThrow('Schema validation failed');

      // Cleanup
      await repo.delete(equipment._id);
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
    userName: getTestUserName(`${crypto.randomUUID()}equipmenttype`)
  });
  const insertResult = await userRepo.insertNew(newUser);
  expect(insertResult).toBeTruthy();
  return newUser;
}
