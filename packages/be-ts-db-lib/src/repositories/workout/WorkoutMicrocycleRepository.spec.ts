import {
  DocumentService,
  WorkoutMicrocycleSchema,
  type WorkoutMicrocycle
} from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../test-util/projects/workout/workoutTestUtil.js';
import UserRepository from '../common/UserRepository.js';
import WorkoutMesocycleRepository from './WorkoutMesocycleRepository.js';
import WorkoutMicrocycleRepository from './WorkoutMicrocycleRepository.js';

const userRepo = UserRepository.getRepo();

describe('WorkoutMicrocycleRepository', () => {
  const repo = WorkoutMicrocycleRepository.getRepo();
  const mesocycleRepo = WorkoutMesocycleRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new microcycle with valid mesocycle reference', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMicrocycleRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });

      const result = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });

      expect(result._id).toBeDefined();
      expect(result.userId).toBe(testUser._id);
      expect(result.workoutMesocycleId).toBe(mesocycle._id);
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutMicrocycle');
    });

    it('should get all microcycles for a user', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMicrocycleRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });

      const microcycle1 = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });
      const microcycle2 = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });

      const allMicrocycles = await repo.getAllForUser(testUser._id);

      expect(allMicrocycles.length).toBeGreaterThanOrEqual(2);
      const ids = allMicrocycles.map((m) => m._id);
      expect(ids).toContain(microcycle1._id);
      expect(ids).toContain(microcycle2._id);
    });

    it('should update a microcycle', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMicrocycleRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });

      const microcycle = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });

      const newStartDate = new Date();
      newStartDate.setDate(newStartDate.getDate() + 7);

      await repo.update({
        _id: microcycle._id,
        startDate: newStartDate
      });

      const updated = await repo.get({ _id: microcycle._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated microcycle');
      }

      expect(updated.startDate.getTime()).toBe(newStartDate.getTime());
    });

    it('should delete a microcycle', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMicrocycleRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });

      const microcycle = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });

      await repo.delete(microcycle._id);

      const retrieved = await repo.get({ _id: microcycle._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Cascading Deletes', () => {
    it('should delete all microcycles when parent mesocycle is deleted', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMicrocycleRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });

      const microcycle1 = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });
      const microcycle2 = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });

      const microcyclesBeforeDelete = await repo.getAllForUser(testUser._id);
      expect(microcyclesBeforeDelete.length).toBeGreaterThanOrEqual(2);

      await mesocycleRepo.delete(mesocycle._id);

      const microcycle1Retrieved = await repo.get({ _id: microcycle1._id });
      const microcycle2Retrieved = await repo.get({ _id: microcycle2._id });

      expect(microcycle1Retrieved).toBeNull();
      expect(microcycle2Retrieved).toBeNull();
    });

    it('should delete all microcycles when user is deleted', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMicrocycleRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });

      const microcycle1 = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });
      const microcycle2 = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });

      const microcyclesBeforeDelete = await repo.getAllForUser(testUser._id);
      expect(microcyclesBeforeDelete.length).toBeGreaterThanOrEqual(2);

      await userRepo.delete(testUser._id);

      const microcycle1Retrieved = await repo.get({ _id: microcycle1._id });
      const microcycle2Retrieved = await repo.get({ _id: microcycle2._id });

      expect(microcycle1Retrieved).toBeNull();
      expect(microcycle2Retrieved).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should reject microcycle with non-existent mesocycle', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMicrocycleRepository');

      const fakeMesocycleId = DocumentService.generateID();
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);

      const newMicrocycle = WorkoutMicrocycleSchema.parse({
        userId: testUser._id,
        workoutMesocycleId: fakeMesocycleId,
        startDate,
        endDate
      });

      await expect(repo.insertNew(newMicrocycle)).rejects.toThrow(
        `Mesocycle with ID ${fakeMesocycleId} does not exist`
      );
    });

    it('should reject invalid microcycle on creation', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMicrocycleRepository');

      const invalidMicrocycle = {
        userId: testUser._id
        // startDate and endDate are missing
      };

      await expect(
        repo.insertNew(invalidMicrocycle as unknown as WorkoutMicrocycle)
      ).rejects.toThrow('Schema validation failed');
    });

    it('should reject update without _id', async () => {
      await expect(
        repo.update({
          startDate: new Date()
        })
      ).rejects.toThrow('No _id defined for WorkoutMicrocycle update.');
    });

    it('should reject update with non-existent mesocycle', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMicrocycleRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });
      const microcycle = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });

      const fakeMesocycleId = DocumentService.generateID();

      await expect(
        repo.update({
          _id: microcycle._id,
          workoutMesocycleId: fakeMesocycleId
        })
      ).rejects.toThrow(`Mesocycle with ID ${fakeMesocycleId} does not exist`);
    });
  });
});
