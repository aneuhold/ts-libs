import {
  DocumentService,
  WorkoutSessionSchema,
  type WorkoutSession
} from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../test-util/projects/workout/workoutTestUtil.js';
import UserRepository from '../common/UserRepository.js';
import WorkoutMicrocycleRepository from './WorkoutMicrocycleRepository.js';
import WorkoutSessionRepository from './WorkoutSessionRepository.js';

const userRepo = UserRepository.getRepo();

describe('WorkoutSessionRepository', () => {
  const repo = WorkoutSessionRepository.getRepo();
  const microcycleRepo = WorkoutMicrocycleRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new session with valid microcycle reference', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });
      const microcycle = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });

      const result = await workoutTestUtil.insertSession({
        userId: testUser._id,
        microcycleId: microcycle._id
      });

      expect(result._id).toBeDefined();
      expect(result.userId).toBe(testUser._id);
      expect(result.workoutMicrocycleId).toBe(microcycle._id);
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutSession');
    });

    it('should get all sessions for a user', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });
      const microcycle = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });

      const session1 = await workoutTestUtil.insertSession({
        userId: testUser._id,
        microcycleId: microcycle._id
      });
      const session2 = await workoutTestUtil.insertSession({
        userId: testUser._id,
        microcycleId: microcycle._id
      });

      const allSessions = await repo.getAllForUser(testUser._id);

      expect(allSessions.length).toBeGreaterThanOrEqual(2);
      const ids = allSessions.map((s) => s._id);
      expect(ids).toContain(session1._id);
      expect(ids).toContain(session2._id);
    });

    it('should update a session', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });
      const microcycle = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });

      const session = await workoutTestUtil.insertSession({
        userId: testUser._id,
        microcycleId: microcycle._id
      });

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
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });
      const microcycle = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });

      const session = await workoutTestUtil.insertSession({
        userId: testUser._id,
        microcycleId: microcycle._id
      });

      await repo.delete(session._id);

      const retrieved = await repo.get({ _id: session._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Cascading Deletes', () => {
    it('should delete all sessions when parent microcycle is deleted', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });
      const microcycle = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });

      const session1 = await workoutTestUtil.insertSession({
        userId: testUser._id,
        microcycleId: microcycle._id
      });
      const session2 = await workoutTestUtil.insertSession({
        userId: testUser._id,
        microcycleId: microcycle._id
      });

      const sessionsBeforeDelete = await repo.getAllForUser(testUser._id);
      expect(sessionsBeforeDelete.length).toBeGreaterThanOrEqual(2);

      await microcycleRepo.delete(microcycle._id);

      const session1Retrieved = await repo.get({ _id: session1._id });
      const session2Retrieved = await repo.get({ _id: session2._id });

      expect(session1Retrieved).toBeNull();
      expect(session2Retrieved).toBeNull();
    });

    it('should delete all sessions when user is deleted', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });
      const microcycle = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });

      const session1 = await workoutTestUtil.insertSession({
        userId: testUser._id,
        microcycleId: microcycle._id
      });
      const session2 = await workoutTestUtil.insertSession({
        userId: testUser._id,
        microcycleId: microcycle._id
      });

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
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionRepository');

      const fakeMicrocycleId = DocumentService.generateID();

      const newSession = WorkoutSessionSchema.parse({
        userId: testUser._id,
        workoutMicrocycleId: fakeMicrocycleId,
        title: 'Test Session',
        startTime: new Date()
      });

      await expect(repo.insertNew(newSession)).rejects.toThrow(
        `Microcycle with ID ${fakeMicrocycleId} does not exist`
      );
    });

    it('should reject invalid session on creation', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionRepository');

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
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });
      const microcycle = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });
      const session = await workoutTestUtil.insertSession({
        userId: testUser._id,
        microcycleId: microcycle._id
      });

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
