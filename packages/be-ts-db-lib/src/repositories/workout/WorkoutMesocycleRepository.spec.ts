import { CycleType, type WorkoutMesocycle } from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../test-util/projects/workout/workoutTestUtil.js';
import UserRepository from '../common/UserRepository.js';
import WorkoutMesocycleRepository from './WorkoutMesocycleRepository.js';
import WorkoutMicrocycleRepository from './WorkoutMicrocycleRepository.js';

const userRepo = UserRepository.getRepo();

describe('WorkoutMesocycleRepository', () => {
  const repo = WorkoutMesocycleRepository.getRepo();
  const microcycleRepo = WorkoutMicrocycleRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new mesocycle', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMesocycleRepository');

      const result = await workoutTestUtil.insertMesocycle({
        userId: testUser._id,
        title: 'Hypertrophy Block',
        cycleType: CycleType.MuscleGain
      });

      expect(result._id).toBeDefined();
      expect(result.title).toBe('Hypertrophy Block');
      expect(result.userId).toBe(testUser._id);
      expect(result.cycleType).toBe(CycleType.MuscleGain);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutMesocycle');
    });

    it('should get all mesocycles for a user', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMesocycleRepository');

      const mesocycle1 = await workoutTestUtil.insertMesocycle({
        userId: testUser._id,
        title: 'Block 1',
        cycleType: CycleType.MuscleGain
      });
      const mesocycle2 = await workoutTestUtil.insertMesocycle({
        userId: testUser._id,
        title: 'Block 2',
        cycleType: CycleType.Cut
      });

      const allMesocycles = await repo.getAllForUser(testUser._id);

      expect(allMesocycles.length).toBeGreaterThanOrEqual(2);
      const ids = allMesocycles.map((m) => m._id);
      expect(ids).toContain(mesocycle1._id);
      expect(ids).toContain(mesocycle2._id);
    });

    it('should update a mesocycle', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMesocycleRepository');

      const mesocycle = await workoutTestUtil.insertMesocycle({
        userId: testUser._id,
        title: 'Initial Name'
      });

      await repo.update({
        _id: mesocycle._id,
        title: 'Updated Name'
      });

      const updated = await repo.get({ _id: mesocycle._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated mesocycle');
      }

      expect(updated.title).toBe('Updated Name');
    });

    it('should delete a mesocycle', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMesocycleRepository');

      const mesocycle = await workoutTestUtil.insertMesocycle({
        userId: testUser._id,
        title: 'To Delete'
      });

      await repo.delete(mesocycle._id);

      const retrieved = await repo.get({ _id: mesocycle._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Cascading Deletes', () => {
    it('should delete all microcycles when mesocycle is deleted', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMesocycleRepository');

      const mesocycle = await workoutTestUtil.insertMesocycle({
        userId: testUser._id,
        title: 'Parent Mesocycle'
      });

      const microcycle1 = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });
      const microcycle2 = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });

      const microcyclesBeforeDelete = await microcycleRepo.getAllForUser(testUser._id);
      expect(microcyclesBeforeDelete.length).toBeGreaterThanOrEqual(2);

      await repo.delete(mesocycle._id);

      const microcycle1Retrieved = await microcycleRepo.get({ _id: microcycle1._id });
      const microcycle2Retrieved = await microcycleRepo.get({ _id: microcycle2._id });

      expect(microcycle1Retrieved).toBeNull();
      expect(microcycle2Retrieved).toBeNull();
    });

    it('should delete all mesocycles when user is deleted', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMesocycleRepository');

      const mesocycle1 = await workoutTestUtil.insertMesocycle({
        userId: testUser._id,
        title: 'Mesocycle 1'
      });
      const mesocycle2 = await workoutTestUtil.insertMesocycle({
        userId: testUser._id,
        title: 'Mesocycle 2',
        cycleType: CycleType.Cut
      });

      const mesocyclesBeforeDelete = await repo.getAllForUser(testUser._id);
      expect(mesocyclesBeforeDelete.length).toBeGreaterThanOrEqual(2);

      await userRepo.delete(testUser._id);

      const mesocycle1Retrieved = await repo.get({ _id: mesocycle1._id });
      const mesocycle2Retrieved = await repo.get({ _id: mesocycle2._id });

      expect(mesocycle1Retrieved).toBeNull();
      expect(mesocycle2Retrieved).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should reject invalid mesocycle on creation', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMesocycleRepository');

      const invalidMesocycle = {
        userId: testUser._id
        // cycleType and required fields are missing
      };

      await expect(repo.insertNew(invalidMesocycle as unknown as WorkoutMesocycle)).rejects.toThrow(
        'Schema validation failed'
      );
    });

    it('should reject update without _id', async () => {
      await expect(
        repo.update({
          title: 'Updated Name'
        } as Partial<WorkoutMesocycle>)
      ).rejects.toThrow('No _id defined for WorkoutMesocycle update.');
    });
  });
});
