import {
  CycleType,
  DocumentService,
  ExerciseRepRange,
  UserSchema,
  WorkoutEquipmentTypeSchema,
  WorkoutExerciseSchema,
  WorkoutMesocycleSchema,
  WorkoutMicrocycleSchema,
  WorkoutMuscleGroupSchema,
  WorkoutSessionExerciseSchema,
  WorkoutSessionSchema,
  type WorkoutSessionExercise
} from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { getTestUserName } from '../../../test-util/testsUtil.js';
import UserRepository from '../common/UserRepository.js';
import WorkoutEquipmentTypeRepository from './WorkoutEquipmentTypeRepository.js';
import WorkoutExerciseRepository from './WorkoutExerciseRepository.js';
import WorkoutMesocycleRepository from './WorkoutMesocycleRepository.js';
import WorkoutMicrocycleRepository from './WorkoutMicrocycleRepository.js';
import WorkoutMuscleGroupRepository from './WorkoutMuscleGroupRepository.js';
import WorkoutSessionExerciseRepository from './WorkoutSessionExerciseRepository.js';
import WorkoutSessionRepository from './WorkoutSessionRepository.js';

const userRepo = UserRepository.getRepo();

describe('WorkoutSessionExerciseRepository', () => {
  const repo = WorkoutSessionExerciseRepository.getRepo();
  const sessionRepo = WorkoutSessionRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new session exercise with valid session and exercise references', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);
      const session = await createSession(testUser._id, microcycle._id);
      const exercise = await createExercise(testUser._id, 'Squat');

      const result = await createSessionExercise(testUser._id, session._id, exercise._id);

      expect(result._id).toBeDefined();
      expect(result.userId).toBe(testUser._id);
      expect(result.workoutSessionId).toBe(session._id);
      expect(result.workoutExerciseId).toBe(exercise._id);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutSessionExercise');
    });

    it('should get all session exercises for a user', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);
      const session = await createSession(testUser._id, microcycle._id);
      const exercise1 = await createExercise(testUser._id, 'Squat');
      const exercise2 = await createExercise(testUser._id, 'Bench Press');

      const sessionExercise1 = await createSessionExercise(
        testUser._id,
        session._id,
        exercise1._id
      );
      const sessionExercise2 = await createSessionExercise(
        testUser._id,
        session._id,
        exercise2._id
      );

      const allSessionExercises = await repo.getAllForUser(testUser._id);

      expect(allSessionExercises.length).toBeGreaterThanOrEqual(2);
      const ids = allSessionExercises.map((se) => se._id);
      expect(ids).toContain(sessionExercise1._id);
      expect(ids).toContain(sessionExercise2._id);
    });

    it('should update a session exercise', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);
      const session = await createSession(testUser._id, microcycle._id);
      const exercise = await createExercise(testUser._id, 'Squat');

      const sessionExercise = await createSessionExercise(testUser._id, session._id, exercise._id);

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
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);
      const session = await createSession(testUser._id, microcycle._id);
      const exercise = await createExercise(testUser._id, 'Squat');

      const sessionExercise = await createSessionExercise(testUser._id, session._id, exercise._id);

      await repo.delete(sessionExercise._id);

      const retrieved = await repo.get({ _id: sessionExercise._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Cascading Deletes', () => {
    it('should delete all session exercises when parent session is deleted', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(
        testUser._id,
        'Parent Mesocycle',
        CycleType.MuscleGain
      );
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);
      const session = await createSession(testUser._id, microcycle._id);
      const exercise1 = await createExercise(testUser._id, 'Squat');
      const exercise2 = await createExercise(testUser._id, 'Bench Press');

      const sessionExercise1 = await createSessionExercise(
        testUser._id,
        session._id,
        exercise1._id
      );
      const sessionExercise2 = await createSessionExercise(
        testUser._id,
        session._id,
        exercise2._id
      );

      const sessionExercisesBeforeDelete = await repo.getAllForUser(testUser._id);
      expect(sessionExercisesBeforeDelete.length).toBeGreaterThanOrEqual(2);

      await sessionRepo.delete(session._id);

      const sessionExercise1Retrieved = await repo.get({ _id: sessionExercise1._id });
      const sessionExercise2Retrieved = await repo.get({ _id: sessionExercise2._id });

      expect(sessionExercise1Retrieved).toBeNull();
      expect(sessionExercise2Retrieved).toBeNull();
    });

    it('should delete all session exercises when user is deleted', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);
      const session = await createSession(testUser._id, microcycle._id);
      const exercise1 = await createExercise(testUser._id, 'Squat');
      const exercise2 = await createExercise(testUser._id, 'Bench Press');

      const sessionExercise1 = await createSessionExercise(
        testUser._id,
        session._id,
        exercise1._id
      );
      const sessionExercise2 = await createSessionExercise(
        testUser._id,
        session._id,
        exercise2._id
      );

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
      const testUser = await createNewTestUser();
      const exercise = await createExercise(testUser._id, 'Squat');

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
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);
      const session = await createSession(testUser._id, microcycle._id);

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
      const testUser = await createNewTestUser();

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
        } as Partial<WorkoutSessionExercise>)
      ).rejects.toThrow('No _id defined for WorkoutSessionExercise update.');
    });
  });
});

/**
 * Create a new test user
 */
async function createNewTestUser() {
  const newUser = UserSchema.parse({
    userName: getTestUserName(`sessionExerciseTest`)
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

/**
 * Create an exercise for testing
 *
 * @param userId the user ID
 * @param exerciseName the exercise name
 */
async function createExercise(userId: UUID, exerciseName: string) {
  const muscleGroup = await WorkoutMuscleGroupRepository.getRepo().insertNew(
    WorkoutMuscleGroupSchema.parse({
      userId,
      name: `Muscle-${exerciseName}`
    })
  );
  if (!muscleGroup) {
    throw new Error(`Failed to insert muscle group`);
  }

  const equipment = await WorkoutEquipmentTypeRepository.getRepo().insertNew(
    WorkoutEquipmentTypeSchema.parse({
      userId,
      title: `Equipment-${exerciseName}`
    })
  );
  if (!equipment) {
    throw new Error(`Failed to insert equipment type`);
  }

  const exercise = await WorkoutExerciseRepository.getRepo().insertNew(
    WorkoutExerciseSchema.parse({
      userId,
      exerciseName,
      workoutEquipmentTypeId: equipment._id,
      initialFatigueGuess: {},
      primaryMuscleGroups: [muscleGroup._id],
      secondaryMuscleGroups: [],
      repRange: ExerciseRepRange.Medium
    })
  );
  if (!exercise) {
    throw new Error(`Failed to insert exercise: ${exerciseName}`);
  }
  return exercise;
}

/**
 * Create a session exercise for testing
 *
 * @param userId the user ID
 * @param sessionId the session ID
 * @param exerciseId the exercise ID
 */
async function createSessionExercise(userId: UUID, sessionId: UUID, exerciseId: UUID) {
  const sessionExercise = await WorkoutSessionExerciseRepository.getRepo().insertNew(
    WorkoutSessionExerciseSchema.parse({
      userId,
      workoutSessionId: sessionId,
      workoutExerciseId: exerciseId
    })
  );
  if (!sessionExercise) {
    throw new Error(`Failed to insert session exercise`);
  }
  return sessionExercise;
}
