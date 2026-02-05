import {
  ExerciseRepRange,
  UserSchema,
  WorkoutEquipmentTypeSchema,
  WorkoutExerciseCalibrationSchema,
  WorkoutExerciseSchema,
  WorkoutMuscleGroupSchema,
  type WorkoutExercise
} from '@aneuhold/core-ts-db-lib';
import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { getTestUserName } from '../../../test-util/testsUtil.js';
import UserRepository from '../common/UserRepository.js';
import WorkoutEquipmentTypeRepository from './WorkoutEquipmentTypeRepository.js';
import WorkoutExerciseCalibrationRepository from './WorkoutExerciseCalibrationRepository.js';
import WorkoutExerciseRepository from './WorkoutExerciseRepository.js';
import WorkoutMuscleGroupRepository from './WorkoutMuscleGroupRepository.js';

const userRepo = UserRepository.getRepo();

describe('WorkoutExerciseRepository', () => {
  const repo = WorkoutExerciseRepository.getRepo();
  const calibrationRepo = WorkoutExerciseCalibrationRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new exercise with muscle groups and equipment', async () => {
      const testUser = await createNewTestUser();

      const primaryMuscleGroup = await createMuscleGroup(testUser._id, 'Quadriceps');
      const secondaryMuscleGroup = await createMuscleGroup(testUser._id, 'Hamstrings');
      const equipment = await createEquipmentType(testUser._id, 'Barbell');

      const result = await createExercise(
        testUser._id,
        'Squat',
        equipment._id,
        [primaryMuscleGroup._id],
        [secondaryMuscleGroup._id],
        ExerciseRepRange.Heavy
      );

      expect(result._id).toBeDefined();
      expect(result.exerciseName).toBe('Squat');
      expect(result.userId).toBe(testUser._id);
      expect(result.primaryMuscleGroups).toHaveLength(1);
      expect(result.secondaryMuscleGroups).toHaveLength(1);
      expect(result.workoutEquipmentTypeId).toBe(equipment._id);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutExercise');
    });

    it('should insert a new exercise without secondary muscle groups', async () => {
      const testUser = await createNewTestUser();

      const muscleGroup = await createMuscleGroup(testUser._id, 'Core');
      const equipment = await createEquipmentType(testUser._id, 'Bodyweight');

      const result = await createExercise(testUser._id, 'Plank', equipment._id, [muscleGroup._id]);

      expect(result._id).toBeDefined();
      expect(result.exerciseName).toBe('Plank');
      expect(result.primaryMuscleGroups).toHaveLength(1);
      expect(result.secondaryMuscleGroups).toHaveLength(0);
    });

    it('should get all exercises for a user', async () => {
      const testUser = await createNewTestUser();

      const muscleGroup = await createMuscleGroup(testUser._id, 'Chest');
      const equipment = await createEquipmentType(testUser._id, 'Barbell');

      const exercise1 = await createExercise(testUser._id, 'Bench Press', equipment._id, [
        muscleGroup._id
      ]);

      const exercise2 = await createExercise(testUser._id, 'Incline Press', equipment._id, [
        muscleGroup._id
      ]);

      const allExercises = await repo.getAllForUser(testUser._id);

      expect(allExercises.length).toBeGreaterThanOrEqual(2);
      const ids = allExercises.map((ex) => ex._id);
      expect(ids).toContain(exercise1._id);
      expect(ids).toContain(exercise2._id);
    });

    it('should update an exercise', async () => {
      const testUser = await createNewTestUser();

      const muscleGroup = await createMuscleGroup(testUser._id, 'Back');
      const equipment = await createEquipmentType(testUser._id, 'Bodyweight');

      const exercise = await createExercise(testUser._id, 'Pull Up', equipment._id, [
        muscleGroup._id
      ]);

      await repo.update({
        _id: exercise._id,
        exerciseName: 'Weighted Pull Up'
      });

      const updated = await repo.get({ _id: exercise._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated exercise');
      }

      expect(updated.exerciseName).toBe('Weighted Pull Up');
    });

    it('should delete an exercise', async () => {
      const testUser = await createNewTestUser();

      const muscleGroup = await createMuscleGroup(testUser._id, 'Shoulders');
      const equipment = await createEquipmentType(testUser._id, 'Barbell');

      const exercise = await createExercise(testUser._id, 'Overhead Press', equipment._id, [
        muscleGroup._id
      ]);

      await repo.delete(exercise._id);

      const retrieved = await repo.get({ _id: exercise._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should reject exercise with non-existent muscle group', async () => {
      const testUser = await createNewTestUser();

      const equipment = await createEquipmentType(testUser._id, 'Barbell');

      const newExercise = WorkoutExerciseSchema.parse({
        userId: testUser._id,
        exerciseName: 'Invalid Exercise',
        workoutEquipmentTypeId: equipment._id,
        initialFatigueGuess: {},
        primaryMuscleGroups: [
          '00000000-0000-7000-8000-000000000000' as `${string}-${string}-${string}-${string}-${string}`
        ],
        repRange: ExerciseRepRange.Medium
      });

      await expect(repo.insertNew(newExercise)).rejects.toThrow(
        'Not all muscle groups exist. Found: 0, expected: 1'
      );
    });

    it('should reject exercise with non-existent equipment type', async () => {
      const testUser = await createNewTestUser();

      const muscleGroup = await createMuscleGroup(testUser._id, 'Legs');

      const fakeEquipmentId = '00000000-0000-7000-8000-000000000000';
      const newExercise = WorkoutExerciseSchema.parse({
        userId: testUser._id,
        exerciseName: 'Invalid Exercise',
        workoutEquipmentTypeId: fakeEquipmentId,
        initialFatigueGuess: {},
        primaryMuscleGroups: [muscleGroup._id],
        repRange: ExerciseRepRange.Medium
      });

      await expect(repo.insertNew(newExercise)).rejects.toThrow(
        `Equipment type with ID ${fakeEquipmentId} does not exist`
      );
    });

    it('should reject invalid exercise on creation', async () => {
      const testUser = await createNewTestUser();

      const invalidExercise = {
        userId: testUser._id
        // exerciseName, workoutEquipmentTypeId, and repRange are missing
      };

      await expect(repo.insertNew(invalidExercise as unknown as WorkoutExercise)).rejects.toThrow(
        'Schema validation failed'
      );
    });

    it('should reject update without _id', async () => {
      await expect(
        repo.update({
          exerciseName: 'Test'
        })
      ).rejects.toThrow('No _id defined for WorkoutExercise update');
    });
  });

  describe('Cascading Deletes', () => {
    it('should delete calibrations when exercise is deleted', async () => {
      const testUser = await createNewTestUser();

      const muscleGroup = await createMuscleGroup(testUser._id, 'Arms');
      const equipment = await createEquipmentType(testUser._id, 'Dumbbell');

      const exercise = await createExercise(testUser._id, 'Bicep Curl', equipment._id, [
        muscleGroup._id
      ]);

      // Create calibrations for the exercise
      const calibration = await calibrationRepo.insertNew(
        WorkoutExerciseCalibrationSchema.parse({
          userId: testUser._id,
          workoutExerciseId: exercise._id,
          reps: 10,
          weight: 25
        })
      );
      if (!calibration) {
        throw new Error('Failed to insert calibration');
      }

      // Verify calibration exists
      const retrievedCalibration = await calibrationRepo.get({ _id: calibration._id });
      expect(retrievedCalibration).toBeTruthy();

      // Delete the exercise
      await repo.delete(exercise._id);

      // Verify calibration is also deleted
      const deletedCalibration = await calibrationRepo.get({ _id: calibration._id });
      expect(deletedCalibration).toBeNull();
    });
  });
});

/**
 * Create a new test user
 */
async function createNewTestUser() {
  const newUser = UserSchema.parse({
    userName: getTestUserName(`${crypto.randomUUID()}exercise`)
  });
  const insertResult = await userRepo.insertNew(newUser);
  expect(insertResult).toBeTruthy();
  return newUser;
}

/**
 * Create a muscle group for testing
 *
 * @param userId the user ID
 * @param name the muscle group name
 */
async function createMuscleGroup(userId: string, name: string) {
  const muscleGroup = await WorkoutMuscleGroupRepository.getRepo().insertNew(
    WorkoutMuscleGroupSchema.parse({
      userId,
      name
    })
  );
  if (!muscleGroup) {
    throw new Error(`Failed to insert muscle group: ${name}`);
  }
  return muscleGroup;
}

/**
 * Create equipment type for testing
 *
 * @param userId the user ID
 * @param title the equipment title
 */
async function createEquipmentType(userId: string, title: string) {
  const equipment = await WorkoutEquipmentTypeRepository.getRepo().insertNew(
    WorkoutEquipmentTypeSchema.parse({
      userId,
      title
    })
  );
  if (!equipment) {
    throw new Error(`Failed to insert equipment type: ${title}`);
  }
  return equipment;
}

/**
 * Create an exercise for testing
 *
 * @param userId the user ID
 * @param exerciseName the exercise name
 * @param equipmentId the equipment ID
 * @param primaryMuscleGroupIds the primary muscle group IDs
 * @param secondaryMuscleGroupIds the secondary muscle group IDs
 * @param repRange the exercise rep range
 */
async function createExercise(
  userId: string,
  exerciseName: string,
  equipmentId: string,
  primaryMuscleGroupIds: string[],
  secondaryMuscleGroupIds?: string[],
  repRange: ExerciseRepRange = ExerciseRepRange.Medium
): Promise<WorkoutExercise> {
  const exercise = await WorkoutExerciseRepository.getRepo().insertNew(
    WorkoutExerciseSchema.parse({
      userId,
      exerciseName,
      workoutEquipmentTypeId: equipmentId,
      initialFatigueGuess: {},
      primaryMuscleGroups: primaryMuscleGroupIds,
      secondaryMuscleGroups: secondaryMuscleGroupIds,
      repRange
    })
  );
  if (!exercise) {
    throw new Error(`Failed to insert exercise: ${exerciseName}`);
  }
  return exercise;
}
