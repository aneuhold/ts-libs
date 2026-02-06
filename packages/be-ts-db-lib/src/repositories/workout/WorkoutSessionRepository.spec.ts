import {
  CycleType,
  DocumentService,
  UserSchema,
  WorkoutMesocycleSchema,
  WorkoutMicrocycleSchema,
  WorkoutSessionSchema,
  type WorkoutSession
} from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { getTestUserName } from '../../../test-util/testsUtil.js';
import UserRepository from '../common/UserRepository.js';
import WorkoutMesocycleRepository from './WorkoutMesocycleRepository.js';
import WorkoutMicrocycleRepository from './WorkoutMicrocycleRepository.js';
import WorkoutSessionRepository from './WorkoutSessionRepository.js';

const userRepo = UserRepository.getRepo();

describe('WorkoutSessionRepository', () => {
  const repo = WorkoutSessionRepository.getRepo();
  const microcycleRepo = WorkoutMicrocycleRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new session with valid microcycle reference', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);

      const result = await createSession(testUser._id, microcycle._id);

      expect(result._id).toBeDefined();
      expect(result.userId).toBe(testUser._id);
      expect(result.workoutMicrocycleId).toBe(microcycle._id);
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutSession');
    });

    it('should get all sessions for a user', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);

      const session1 = await createSession(testUser._id, microcycle._id);
      const session2 = await createSession(testUser._id, microcycle._id);

      const allSessions = await repo.getAllForUser(testUser._id);

      expect(allSessions.length).toBeGreaterThanOrEqual(2);
      const ids = allSessions.map((s) => s._id);
      expect(ids).toContain(session1._id);
      expect(ids).toContain(session2._id);
    });

    it('should update a session', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);

      const session = await createSession(testUser._id, microcycle._id);

      const newStartTime = new Date();
      newStartTime.setDate(newStartTime.getDate() + 1);

      await repo.update({
        _id: session._id,
        startTime: newStartTime
      });

      const updated = await repo.get({ _id: session._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated session');
      }

      expect(updated.startTime.getTime()).toBe(newStartTime.getTime());
    });

    it('should delete a session', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);

      const session = await createSession(testUser._id, microcycle._id);

      await repo.delete(session._id);

      const retrieved = await repo.get({ _id: session._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Cascading Deletes', () => {
    it('should delete all sessions when parent microcycle is deleted', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(
        testUser._id,
        'Parent Mesocycle',
        CycleType.MuscleGain
      );
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);

      const session1 = await createSession(testUser._id, microcycle._id);
      const session2 = await createSession(testUser._id, microcycle._id);

      const sessionsBeforeDelete = await repo.getAllForUser(testUser._id);
      expect(sessionsBeforeDelete.length).toBeGreaterThanOrEqual(2);

      await microcycleRepo.delete(microcycle._id);

      const session1Retrieved = await repo.get({ _id: session1._id });
      const session2Retrieved = await repo.get({ _id: session2._id });

      expect(session1Retrieved).toBeNull();
      expect(session2Retrieved).toBeNull();
    });

    it('should delete all sessions when user is deleted', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);

      const session1 = await createSession(testUser._id, microcycle._id);
      const session2 = await createSession(testUser._id, microcycle._id);

      const sessionsBeforeDelete = await repo.getAllForUser(testUser._id);
      expect(sessionsBeforeDelete.length).toBeGreaterThanOrEqual(2);

      await userRepo.delete(testUser._id);

      const session1Retrieved = await repo.get({ _id: session1._id });
      const session2Retrieved = await repo.get({ _id: session2._id });

      expect(session1Retrieved).toBeNull();
      expect(session2Retrieved).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should reject session with non-existent microcycle', async () => {
      const testUser = await createNewTestUser();

      const fakeMicrocycleId = DocumentService.generateID();
      const startTime = new Date();

      const newSession = WorkoutSessionSchema.parse({
        userId: testUser._id,
        workoutMicrocycleId: fakeMicrocycleId,
        title: 'Test Session',
        startTime
      });

      await expect(repo.insertNew(newSession)).rejects.toThrow(
        `Microcycle with ID ${fakeMicrocycleId} does not exist`
      );
    });

    it('should reject invalid session on creation', async () => {
      const testUser = await createNewTestUser();

      const invalidSession = {
        userId: testUser._id
        // title and startTime are missing
      };

      await expect(repo.insertNew(invalidSession as unknown as WorkoutSession)).rejects.toThrow(
        'Schema validation failed'
      );
    });

    it('should reject update without _id', async () => {
      await expect(
        repo.update({
          startTime: new Date()
        } as Partial<WorkoutSession>)
      ).rejects.toThrow('No _id defined for WorkoutSession update.');
    });

    it('should reject update with non-existent microcycle', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);
      const session = await createSession(testUser._id, microcycle._id);

      const fakeMicrocycleId = DocumentService.generateID();

      await expect(
        repo.update({
          _id: session._id,
          workoutMicrocycleId: fakeMicrocycleId
        })
      ).rejects.toThrow(`Microcycle with ID ${fakeMicrocycleId} does not exist`);
    });
  });
});

/**
 * Create a new test user
 */
async function createNewTestUser() {
  const newUser = UserSchema.parse({
    userName: getTestUserName(`session`)
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

/**
 * Create a session for testing
 *
 * @param userId the user ID
 * @param microcycleId the parent microcycle ID
 */
async function createSession(userId: UUID, microcycleId: UUID) {
  const startTime = new Date();

  const session = await WorkoutSessionRepository.getRepo().insertNew(
    WorkoutSessionSchema.parse({
      userId,
      workoutMicrocycleId: microcycleId,
      title: 'Test Session',
      startTime
    })
  );
  if (!session) {
    throw new Error(`Failed to insert session`);
  }
  return session;
}
