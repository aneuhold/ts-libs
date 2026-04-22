import { WorkoutEquipmentTypeSchema, type WorkoutEquipmentType } from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../test-util/projects/workout/workoutTestUtil.js';
import WorkoutEquipmentTypeRepository from './WorkoutEquipmentTypeRepository.js';

describe('WorkoutEquipmentTypeRepository', () => {
  const repo = WorkoutEquipmentTypeRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new equipment type with weight options', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutEquipmentTypeRepository');
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
    });

    it('should insert equipment type without weight options', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutEquipmentTypeRepository');
      const newEquipment = WorkoutEquipmentTypeSchema.parse({
        userId: testUser._id,
        title: 'Bodyweight'
      });

      const result = await repo.insertNew(newEquipment);
      if (!result) {
        throw new Error('Failed to insert equipment');
      }

      expect(result.weightOptions).toBeUndefined();
    });

    it('should update equipment type and modify weight options', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutEquipmentTypeRepository');
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Dumbbell');

      await repo.update({
        _id: equipment._id,
        weightOptions: [10, 15, 20, 25, 30]
      });

      const updated = await repo.get({ _id: equipment._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated equipment');
      }

      expect(updated.weightOptions).toEqual([10, 15, 20, 25, 30]);
    });
  });

  describe('Validation', () => {
    it('should reject invalid equipment type on creation', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutEquipmentTypeRepository');
      const invalidEquipment = {
        userId: testUser._id
        // title is missing
      };

      await expect(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
      const testUser = await workoutTestUtil.insertUser('WorkoutEquipmentTypeRepository');
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Test Equipment');

      const invalidUpdate = {
        _id: equipment._id,
        title: 123
      };

      await expect(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        repo.update(invalidUpdate as unknown as WorkoutEquipmentType)
      ).rejects.toThrow('Schema validation failed');
    });
  });
});
