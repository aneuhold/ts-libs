import {
  DocumentService,
  WorkoutSessionExerciseSchema,
  type WorkoutSessionExercise
} from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../test-util/projects/workout/workoutTestUtil.js';
import UserRepository from '../common/UserRepository.js';
import WorkoutSessionExerciseRepository from './WorkoutSessionExerciseRepository.js';
import WorkoutSessionRepository from './WorkoutSessionRepository.js';

const userRepo = UserRepository.getRepo();

describe('WorkoutSessionExerciseRepository', () => {
  const repo = WorkoutSessionExerciseRepository.getRepo();
  const sessionRepo = WorkoutSessionRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new session exercise with valid session and exercise references', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionExerciseRepository');
      const { exercise, session } = await workoutTestUtil.insertSessionSetup({
        userId: testUser._id,
        exerciseName: 'Squat'
      });

      const result = await workoutTestUtil.insertSessionExercise({
        userId: testUser._id,
        sessionId: session._id,
        exerciseId: exercise._id
      });

      expect(result._id).toBeDefined();
      expect(result.userId).toBe(testUser._id);
      expect(result.workoutSessionId).toBe(session._id);
      expect(result.workoutExerciseId).toBe(exercise._id);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutSessionExercise');
    });

    it('should get all session exercises for a user', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionExerciseRepository');
      const { session, exercise: exercise1 } = await workoutTestUtil.insertSessionSetup({
        userId: testUser._id,
        exerciseName: 'Squat'
      });
      const mg2 = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Muscle-Bench');
      const eq2 = await workoutTestUtil.insertEquipmentType(testUser._id, 'Equipment-Bench');
      const exercise2 = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: eq2._id,
        primaryMuscleGroupIds: [mg2._id],
        name: 'Bench Press'
      });

      const sessionExercise1 = await workoutTestUtil.insertSessionExercise({
        userId: testUser._id,
        sessionId: session._id,
        exerciseId: exercise1._id
      });
      const sessionExercise2 = await workoutTestUtil.insertSessionExercise({
        userId: testUser._id,
        sessionId: session._id,
        exerciseId: exercise2._id
      });

      const allSessionExercises = await repo.getAllForUser(testUser._id);

      expect(allSessionExercises.length).toBeGreaterThanOrEqual(2);
      const ids = allSessionExercises.map((se) => se._id);
      expect(ids).toContain(sessionExercise1._id);
      expect(ids).toContain(sessionExercise2._id);
    });

    it('should update a session exercise', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionExerciseRepository');
      const { exercise, session } = await workoutTestUtil.insertSessionSetup({
        userId: testUser._id,
        exerciseName: 'Squat'
      });

      const sessionExercise = await workoutTestUtil.insertSessionExercise({
        userId: testUser._id,
        sessionId: session._id,
        exerciseId: exercise._id
      });

      await repo.update({
        _id: sessionExercise._id,
        setOrder: []
      });

      const updated = await repo.get({ _id: sessionExercise._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated session exercise');
      }

      expect(updated.setOrder).toEqual([]);
    });

    it('should delete a session exercise', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionExerciseRepository');
      const { exercise, session } = await workoutTestUtil.insertSessionSetup({
        userId: testUser._id,
        exerciseName: 'Squat'
      });

      const sessionExercise = await workoutTestUtil.insertSessionExercise({
        userId: testUser._id,
        sessionId: session._id,
        exerciseId: exercise._id
      });

      await repo.delete(sessionExercise._id);

      const retrieved = await repo.get({ _id: sessionExercise._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Cascading Deletes', () => {
    it('should delete all session exercises when parent session is deleted', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionExerciseRepository');
      const { session, exercise: exercise1 } = await workoutTestUtil.insertSessionSetup({
        userId: testUser._id,
        exerciseName: 'Squat'
      });
      const mg2 = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Muscle-Bench');
      const eq2 = await workoutTestUtil.insertEquipmentType(testUser._id, 'Equipment-Bench');
      const exercise2 = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: eq2._id,
        primaryMuscleGroupIds: [mg2._id],
        name: 'Bench Press'
      });

      const sessionExercise1 = await workoutTestUtil.insertSessionExercise({
        userId: testUser._id,
        sessionId: session._id,
        exerciseId: exercise1._id
      });
      const sessionExercise2 = await workoutTestUtil.insertSessionExercise({
        userId: testUser._id,
        sessionId: session._id,
        exerciseId: exercise2._id
      });

      const sessionExercisesBeforeDelete = await repo.getAllForUser(testUser._id);
      expect(sessionExercisesBeforeDelete.length).toBeGreaterThanOrEqual(2);

      await sessionRepo.delete(session._id);

      const sessionExercise1Retrieved = await repo.get({ _id: sessionExercise1._id });
      const sessionExercise2Retrieved = await repo.get({ _id: sessionExercise2._id });

      expect(sessionExercise1Retrieved).toBeNull();
      expect(sessionExercise2Retrieved).toBeNull();
    });

    it('should delete all session exercises when user is deleted', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionExerciseRepository');
      const { session, exercise: exercise1 } = await workoutTestUtil.insertSessionSetup({
        userId: testUser._id,
        exerciseName: 'Squat'
      });
      const mg2 = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Muscle-Bench');
      const eq2 = await workoutTestUtil.insertEquipmentType(testUser._id, 'Equipment-Bench');
      const exercise2 = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: eq2._id,
        primaryMuscleGroupIds: [mg2._id],
        name: 'Bench Press'
      });

      const sessionExercise1 = await workoutTestUtil.insertSessionExercise({
        userId: testUser._id,
        sessionId: session._id,
        exerciseId: exercise1._id
      });
      const sessionExercise2 = await workoutTestUtil.insertSessionExercise({
        userId: testUser._id,
        sessionId: session._id,
        exerciseId: exercise2._id
      });

      const sessionExercisesBeforeDelete = await repo.getAllForUser(testUser._id);
      expect(sessionExercisesBeforeDelete.length).toBeGreaterThanOrEqual(2);

      await userRepo.delete(testUser._id);

      const sessionExercise1Retrieved = await repo.get({ _id: sessionExercise1._id });
      const sessionExercise2Retrieved = await repo.get({ _id: sessionExercise2._id });

      expect(sessionExercise1Retrieved).toBeNull();
      expect(sessionExercise2Retrieved).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should reject session exercise with non-existent session', async () => {
      const { testUser, exercise } = await workoutTestUtil.insertExerciseSetup({
        prefix: 'WorkoutSessionExerciseRepository',
        exerciseName: 'Squat'
      });

      const fakeSessionId = DocumentService.generateID();

      const newSessionExercise = WorkoutSessionExerciseSchema.parse({
        userId: testUser._id,
        workoutSessionId: fakeSessionId,
        workoutExerciseId: exercise._id,
        orderNum: 1
      });

      await expect(repo.insertNew(newSessionExercise)).rejects.toThrow(
        `Session with ID ${fakeSessionId} does not exist`
      );
    });

    it('should reject session exercise with non-existent exercise', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionExerciseRepository');
      const mesocycle = await workoutTestUtil.insertMesocycle({ userId: testUser._id });
      const microcycle = await workoutTestUtil.insertMicrocycle({
        userId: testUser._id,
        mesocycleId: mesocycle._id
      });
      const session = await workoutTestUtil.insertSession({
        userId: testUser._id,
        microcycleId: microcycle._id
      });

      const fakeExerciseId = DocumentService.generateID();

      const newSessionExercise = WorkoutSessionExerciseSchema.parse({
        userId: testUser._id,
        workoutSessionId: session._id,
        workoutExerciseId: fakeExerciseId,
        orderNum: 1
      });

      await expect(repo.insertNew(newSessionExercise)).rejects.toThrow(
        `Exercise with ID ${fakeExerciseId} does not exist`
      );
    });

    it('should reject invalid session exercise on creation', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutSessionExerciseRepository');

      const invalidSessionExercise = {
        userId: testUser._id
        // workoutSessionId and workoutExerciseId are missing
      };

      await expect(
        repo.insertNew(invalidSessionExercise as unknown as WorkoutSessionExercise)
      ).rejects.toThrow('Schema validation failed');
    });

    it('should reject update without _id', async () => {
      await expect(
        repo.update({
          setOrder: []
        })
      ).rejects.toThrow('No _id defined for WorkoutSessionExercise update.');
    });
  });
});
