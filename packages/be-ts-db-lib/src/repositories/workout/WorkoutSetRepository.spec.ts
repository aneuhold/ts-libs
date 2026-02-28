import { DocumentService, WorkoutSetSchema, type WorkoutSet } from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../test-util/projects/workout/workoutTestUtil.js';
import UserRepository from '../common/UserRepository.js';
import WorkoutSessionExerciseRepository from './WorkoutSessionExerciseRepository.js';
import WorkoutSetRepository from './WorkoutSetRepository.js';

const userRepo = UserRepository.getRepo();

describe('WorkoutSetRepository', () => {
  const repo = WorkoutSetRepository.getRepo();
  const sessionExerciseRepo = WorkoutSessionExerciseRepository.getRepo();

  /**
   * Creates a full hierarchy (user -> exercise setup -> session setup ->
   * session exercise) for set tests.
   *
   * @param exerciseName - Name for the exercise.
   */
  async function createTestSetSetup(exerciseName: string) {
    const { testUser, exercise } = await workoutTestUtil.insertExerciseSetup({
      prefix: 'WorkoutSetRepository',
      exerciseName
    });
    const { session } = await workoutTestUtil.insertSessionSetup({
      userId: testUser._id,
      exerciseName: `${exerciseName}-session`
    });
    const sessionExercise = await workoutTestUtil.insertSessionExercise({
      userId: testUser._id,
      sessionId: session._id,
      exerciseId: exercise._id
    });
    return { testUser, exercise, session, sessionExercise };
  }

  describe('Basic CRUD Operations', () => {
    it('should insert a new set with valid session exercise reference', async () => {
      const { testUser, exercise, session, sessionExercise } = await createTestSetSetup('Squat');

      const result = await workoutTestUtil.insertSet({
        userId: testUser._id,
        exerciseId: exercise._id,
        sessionId: session._id,
        sessionExerciseId: sessionExercise._id,
        actualWeight: 100,
        actualReps: 10
      });

      expect(result._id).toBeDefined();
      expect(result.userId).toBe(testUser._id);
      expect(result.workoutSessionExerciseId).toBe(sessionExercise._id);
      expect(result.actualWeight).toBe(100);
      expect(result.actualReps).toBe(10);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutSet');
    });

    it('should get all sets for a user', async () => {
      const { testUser, exercise, session, sessionExercise } = await createTestSetSetup('Squat');

      const set1 = await workoutTestUtil.insertSet({
        userId: testUser._id,
        exerciseId: exercise._id,
        sessionId: session._id,
        sessionExerciseId: sessionExercise._id,
        actualWeight: 100,
        actualReps: 10
      });
      const set2 = await workoutTestUtil.insertSet({
        userId: testUser._id,
        exerciseId: exercise._id,
        sessionId: session._id,
        sessionExerciseId: sessionExercise._id,
        actualWeight: 150,
        actualReps: 8
      });

      const allSets = await repo.getAllForUser(testUser._id);

      expect(allSets.length).toBeGreaterThanOrEqual(2);
      const ids = allSets.map((s) => s._id);
      expect(ids).toContain(set1._id);
      expect(ids).toContain(set2._id);
    });

    it('should update a set', async () => {
      const { testUser, exercise, session, sessionExercise } = await createTestSetSetup('Squat');

      const set = await workoutTestUtil.insertSet({
        userId: testUser._id,
        exerciseId: exercise._id,
        sessionId: session._id,
        sessionExerciseId: sessionExercise._id,
        actualWeight: 100,
        actualReps: 10
      });

      await repo.update({
        _id: set._id,
        actualWeight: 120,
        actualReps: 8
      });

      const updated = await repo.get({ _id: set._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated set');
      }

      expect(updated.actualWeight).toBe(120);
      expect(updated.actualReps).toBe(8);
    });

    it('should delete a set', async () => {
      const { testUser, exercise, session, sessionExercise } = await createTestSetSetup('Squat');

      const set = await workoutTestUtil.insertSet({
        userId: testUser._id,
        exerciseId: exercise._id,
        sessionId: session._id,
        sessionExerciseId: sessionExercise._id,
        actualWeight: 100,
        actualReps: 10
      });

      await repo.delete(set._id);

      const retrieved = await repo.get({ _id: set._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Cascading Deletes', () => {
    it('should delete all sets when parent session exercise is deleted', async () => {
      const { testUser, exercise, session, sessionExercise } = await createTestSetSetup('Squat');

      const set1 = await workoutTestUtil.insertSet({
        userId: testUser._id,
        exerciseId: exercise._id,
        sessionId: session._id,
        sessionExerciseId: sessionExercise._id,
        actualWeight: 100,
        actualReps: 10
      });
      const set2 = await workoutTestUtil.insertSet({
        userId: testUser._id,
        exerciseId: exercise._id,
        sessionId: session._id,
        sessionExerciseId: sessionExercise._id,
        actualWeight: 150,
        actualReps: 8
      });

      const setsBeforeDelete = await repo.getAllForUser(testUser._id);
      expect(setsBeforeDelete.length).toBeGreaterThanOrEqual(2);

      await sessionExerciseRepo.delete(sessionExercise._id);

      const set1Retrieved = await repo.get({ _id: set1._id });
      const set2Retrieved = await repo.get({ _id: set2._id });

      expect(set1Retrieved).toBeNull();
      expect(set2Retrieved).toBeNull();
    });

    it('should delete all sets when user is deleted', async () => {
      const { testUser, exercise, session, sessionExercise } = await createTestSetSetup('Squat');

      const set1 = await workoutTestUtil.insertSet({
        userId: testUser._id,
        exerciseId: exercise._id,
        sessionId: session._id,
        sessionExerciseId: sessionExercise._id,
        actualWeight: 100,
        actualReps: 10
      });
      const set2 = await workoutTestUtil.insertSet({
        userId: testUser._id,
        exerciseId: exercise._id,
        sessionId: session._id,
        sessionExerciseId: sessionExercise._id,
        actualWeight: 150,
        actualReps: 8
      });

      const setsBeforeDelete = await repo.getAllForUser(testUser._id);
      expect(setsBeforeDelete.length).toBeGreaterThanOrEqual(2);

      await userRepo.delete(testUser._id);

      const set1Retrieved = await repo.get({ _id: set1._id });
      const set2Retrieved = await repo.get({ _id: set2._id });

      expect(set1Retrieved).toBeNull();
      expect(set2Retrieved).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should reject set with non-existent session exercise', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSetRepository');

      const fakeSessionExerciseId = DocumentService.generateID();

      const newSet = WorkoutSetSchema.parse({
        userId: testUser._id,
        workoutExerciseId: DocumentService.generateID(),
        workoutSessionId: DocumentService.generateID(),
        workoutSessionExerciseId: fakeSessionExerciseId
      });

      await expect(repo.insertNew(newSet)).rejects.toThrow(
        `Session exercise with ID ${fakeSessionExerciseId} does not exist`
      );
    });

    it('should reject invalid set on creation', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSetRepository');

      const invalidSet = {
        userId: testUser._id
        // workoutSessionExerciseId is missing
      };

      await expect(repo.insertNew(invalidSet as unknown as WorkoutSet)).rejects.toThrow(
        'Schema validation failed'
      );
    });

    it('should reject update without _id', async () => {
      await expect(
        repo.update({
          actualWeight: 100
        } as Partial<WorkoutSet>)
      ).rejects.toThrow('No _id defined for WorkoutSet update.');
    });
  });
});
