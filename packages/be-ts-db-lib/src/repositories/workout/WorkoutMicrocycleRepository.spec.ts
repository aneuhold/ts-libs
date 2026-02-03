import {
  CycleType,
  DocumentService,
  UserSchema,
  WorkoutMesocycleSchema,
  WorkoutMicrocycleSchema,
  type WorkoutMicrocycle
} from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { cleanupDoc, getTestUserName } from '../../../test-util/testsUtil.js';
import UserRepository from '../common/UserRepository.js';
import WorkoutMesocycleRepository from './WorkoutMesocycleRepository.js';
import WorkoutMicrocycleRepository from './WorkoutMicrocycleRepository.js';

const userRepo = UserRepository.getRepo();

describe('WorkoutMicrocycleRepository', () => {
  const repo = WorkoutMicrocycleRepository.getRepo();
  const mesocycleRepo = WorkoutMesocycleRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new microcycle with valid mesocycle reference', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);

      const result = await createMicrocycle(testUser._id, mesocycle._id);

      expect(result._id).toBeDefined();
      expect(result.userId).toBe(testUser._id);
      expect(result.workoutMesocycleId).toBe(mesocycle._id);
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutMicrocycle');

      await cleanupDoc(userRepo, testUser);
    });

    it('should get all microcycles for a user', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);

      const microcycle1 = await createMicrocycle(testUser._id, mesocycle._id);
      const microcycle2 = await createMicrocycle(testUser._id, mesocycle._id);

      const allMicrocycles = await repo.getAllForUser(testUser._id);

      expect(allMicrocycles.length).toBeGreaterThanOrEqual(2);
      const ids = allMicrocycles.map((m) => m._id);
      expect(ids).toContain(microcycle1._id);
      expect(ids).toContain(microcycle2._id);

      await cleanupDoc(userRepo, testUser);
    });

    it('should update a microcycle', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);

      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);

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

      await cleanupDoc(userRepo, testUser);
    });

    it('should delete a microcycle', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);

      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);

      await repo.delete(microcycle._id);

      const retrieved = await repo.get({ _id: microcycle._id });
      expect(retrieved).toBeNull();
      await cleanupDoc(userRepo, testUser);
    });
  });

  describe('Cascading Deletes', () => {
    it('should delete all microcycles when parent mesocycle is deleted', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(
        testUser._id,
        'Parent Mesocycle',
        CycleType.MuscleGain
      );

      const microcycle1 = await createMicrocycle(testUser._id, mesocycle._id);
      const microcycle2 = await createMicrocycle(testUser._id, mesocycle._id);

      const microcyclesBeforeDelete = await repo.getAllForUser(testUser._id);
      expect(microcyclesBeforeDelete.length).toBeGreaterThanOrEqual(2);

      await mesocycleRepo.delete(mesocycle._id);

      const microcycle1Retrieved = await repo.get({ _id: microcycle1._id });
      const microcycle2Retrieved = await repo.get({ _id: microcycle2._id });

      expect(microcycle1Retrieved).toBeNull();
      expect(microcycle2Retrieved).toBeNull();

      await cleanupDoc(userRepo, testUser);
    });

    it('should delete all microcycles when user is deleted', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);

      const microcycle1 = await createMicrocycle(testUser._id, mesocycle._id);
      const microcycle2 = await createMicrocycle(testUser._id, mesocycle._id);

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
      const testUser = await createNewTestUser();

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

      await cleanupDoc(userRepo, testUser);
    });

    it('should reject invalid microcycle on creation', async () => {
      const testUser = await createNewTestUser();

      const invalidMicrocycle = {
        userId: testUser._id
        // startDate and endDate are missing
      };

      await expect(
        repo.insertNew(invalidMicrocycle as unknown as WorkoutMicrocycle)
      ).rejects.toThrow('Schema validation failed');

      await cleanupDoc(userRepo, testUser);
    });

    it('should reject update without _id', async () => {
      const testUser = await createNewTestUser();

      await expect(
        repo.update({
          startDate: new Date()
        } as Partial<WorkoutMicrocycle>)
      ).rejects.toThrow('No _id defined for WorkoutMicrocycle update.');

      await cleanupDoc(userRepo, testUser);
    });

    it('should reject update with non-existent mesocycle', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);

      const fakeMesocycleId = DocumentService.generateID();

      await expect(
        repo.update({
          _id: microcycle._id,
          workoutMesocycleId: fakeMesocycleId
        })
      ).rejects.toThrow(`Mesocycle with ID ${fakeMesocycleId} does not exist`);

      await cleanupDoc(userRepo, testUser);
    });
  });
});

/**
 * Create a new test user
 */
async function createNewTestUser() {
  const newUser = UserSchema.parse({
    userName: getTestUserName(`${crypto.randomUUID()}microcycle`)
  });
  const insertResult = await userRepo.insertNew(newUser);
  expect(insertResult).toBeTruthy();
  return newUser;
}

/**
 * Create a mesocycle for testing
 *
 * @param userId the user ID
 * @param title the mesocycle title
 * @param cycleType the cycle type
 */
async function createMesocycle(userId: UUID, title: string, cycleType: CycleType) {
  const mesocycle = await WorkoutMesocycleRepository.getRepo().insertNew(
    WorkoutMesocycleSchema.parse({
      userId,
      title,
      cycleType,
      plannedSessionCountPerMicrocycle: 1,
      plannedMicrocycleLengthInDays: 7,
      calibratedExercises: [DocumentService.generateID()]
    })
  );
  if (!mesocycle) {
    throw new Error(`Failed to insert mesocycle: ${title}`);
  }
  return mesocycle;
}

/**
 * Create a microcycle for testing
 *
 * @param userId the user ID
 * @param mesocycleId the parent mesocycle ID
 */
async function createMicrocycle(userId: UUID, mesocycleId: UUID) {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  const microcycle = await WorkoutMicrocycleRepository.getRepo().insertNew(
    WorkoutMicrocycleSchema.parse({
      userId,
      workoutMesocycleId: mesocycleId,
      startDate,
      endDate
    })
  );
  if (!microcycle) {
    throw new Error(`Failed to insert microcycle`);
  }
  return microcycle;
}
