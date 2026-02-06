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
  WorkoutSetSchema,
  type WorkoutSet
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
import WorkoutSetRepository from './WorkoutSetRepository.js';

const userRepo = UserRepository.getRepo();

describe('WorkoutSetRepository', () => {
  const repo = WorkoutSetRepository.getRepo();
  const sessionExerciseRepo = WorkoutSessionExerciseRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new set with valid session exercise reference', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);
      const session = await createSession(testUser._id, microcycle._id);
      const exercise = await createExercise(testUser._id, 'Squat');
      const sessionExercise = await createSessionExercise(testUser._id, session._id, exercise._id);

      const result = await createSet(testUser._id, sessionExercise._id, 100, 10);

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
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);
      const session = await createSession(testUser._id, microcycle._id);
      const exercise = await createExercise(testUser._id, 'Squat');
      const sessionExercise = await createSessionExercise(testUser._id, session._id, exercise._id);

      const set1 = await createSet(testUser._id, sessionExercise._id, 100, 10);
      const set2 = await createSet(testUser._id, sessionExercise._id, 150, 8);

      const allSets = await repo.getAllForUser(testUser._id);

      expect(allSets.length).toBeGreaterThanOrEqual(2);
      const ids = allSets.map((s) => s._id);
      expect(ids).toContain(set1._id);
      expect(ids).toContain(set2._id);
    });

    it('should update a set', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);
      const session = await createSession(testUser._id, microcycle._id);
      const exercise = await createExercise(testUser._id, 'Squat');
      const sessionExercise = await createSessionExercise(testUser._id, session._id, exercise._id);

      const set = await createSet(testUser._id, sessionExercise._id, 100, 10);

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
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);
      const session = await createSession(testUser._id, microcycle._id);
      const exercise = await createExercise(testUser._id, 'Squat');
      const sessionExercise = await createSessionExercise(testUser._id, session._id, exercise._id);

      const set = await createSet(testUser._id, sessionExercise._id, 100, 10);

      await repo.delete(set._id);

      const retrieved = await repo.get({ _id: set._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Cascading Deletes', () => {
    it('should delete all sets when parent session exercise is deleted', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(
        testUser._id,
        'Parent Mesocycle',
        CycleType.MuscleGain
      );
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);
      const session = await createSession(testUser._id, microcycle._id);
      const exercise = await createExercise(testUser._id, 'Squat');
      const sessionExercise = await createSessionExercise(testUser._id, session._id, exercise._id);

      const set1 = await createSet(testUser._id, sessionExercise._id, 100, 10);
      const set2 = await createSet(testUser._id, sessionExercise._id, 150, 8);

      const setsBeforeDelete = await repo.getAllForUser(testUser._id);
      expect(setsBeforeDelete.length).toBeGreaterThanOrEqual(2);

      await sessionExerciseRepo.delete(sessionExercise._id);

      const set1Retrieved = await repo.get({ _id: set1._id });
      const set2Retrieved = await repo.get({ _id: set2._id });

      expect(set1Retrieved).toBeNull();
      expect(set2Retrieved).toBeNull();
    });

    it('should delete all sets when user is deleted', async () => {
      const testUser = await createNewTestUser();
      const mesocycle = await createMesocycle(testUser._id, 'Test Mesocycle', CycleType.MuscleGain);
      const microcycle = await createMicrocycle(testUser._id, mesocycle._id);
      const session = await createSession(testUser._id, microcycle._id);
      const exercise = await createExercise(testUser._id, 'Squat');
      const sessionExercise = await createSessionExercise(testUser._id, session._id, exercise._id);

      const set1 = await createSet(testUser._id, sessionExercise._id, 100, 10);
      const set2 = await createSet(testUser._id, sessionExercise._id, 150, 8);

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
      const testUser = await createNewTestUser();

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
      const testUser = await createNewTestUser();

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

/**
 * Create a new test user
 */
async function createNewTestUser() {
  const newUser = UserSchema.parse({
    userName: getTestUserName(`set`)
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

/**
 * Create a set for testing
 *
 * @param userId the user ID
 * @param sessionExerciseId the session exercise ID
 * @param weight the weight
 * @param reps the reps
 */
async function createSet(userId: UUID, sessionExerciseId: UUID, weight: number, reps: number) {
  const set = await WorkoutSetRepository.getRepo().insertNew(
    WorkoutSetSchema.parse({
      userId,
      workoutExerciseId: DocumentService.generateID(),
      workoutSessionId: DocumentService.generateID(),
      workoutSessionExerciseId: sessionExerciseId,
      actualWeight: weight,
      actualReps: reps
    })
  );
  if (!set) {
    throw new Error(`Failed to insert set`);
  }
  return set;
}
