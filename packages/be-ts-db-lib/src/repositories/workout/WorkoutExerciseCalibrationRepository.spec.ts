import {
  ExerciseRepRange,
  UserSchema,
  WorkoutEquipmentTypeSchema,
  WorkoutExerciseCalibrationSchema,
  WorkoutExerciseSchema,
  WorkoutMuscleGroupSchema,
  type WorkoutExerciseCalibration
} from '@aneuhold/core-ts-db-lib';
import crypto, { type UUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { cleanupDoc, getTestUserName } from '../../../test-util/testsUtil.js';
import UserRepository from '../common/UserRepository.js';
import WorkoutEquipmentTypeRepository from './WorkoutEquipmentTypeRepository.js';
import WorkoutExerciseCalibrationRepository from './WorkoutExerciseCalibrationRepository.js';
import WorkoutExerciseRepository from './WorkoutExerciseRepository.js';
import WorkoutMuscleGroupRepository from './WorkoutMuscleGroupRepository.js';

const userRepo = UserRepository.getRepo();

describe('WorkoutExerciseCalibrationRepository', () => {
  const repo = WorkoutExerciseCalibrationRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new calibration', async () => {
      const testUser = await createNewTestUser();

      const muscleGroup = await createMuscleGroup(testUser._id, 'Chest');
      const equipment = await createEquipmentType(testUser._id, 'Barbell');

      const exercise = await createExercise(testUser._id, 'Bench Press', equipment._id, [
        muscleGroup._id
      ]);

      const newCalibration = WorkoutExerciseCalibrationSchema.parse({
        userId: testUser._id,
        workoutExerciseId: exercise._id,
        reps: 10,
        weight: 135
      });

      const result = await repo.insertNew(newCalibration);
      if (!result) {
        throw new Error('Failed to insert calibration');
      }

      expect(result._id).toBeDefined();
      expect(result.workoutExerciseId).toBe(exercise._id);
      expect(result.reps).toBe(10);
      expect(result.weight).toBe(135);
      expect(result.userId).toBe(testUser._id);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutExerciseCalibration');

      // Cleanup
      await cleanupDoc(userRepo, testUser);
    });

    it('should get all calibrations for a user', async () => {
      const testUser = await createNewTestUser();

      const muscleGroup = await createMuscleGroup(testUser._id, 'Legs');
      const equipment = await createEquipmentType(testUser._id, 'Barbell');

      const exercise = await createExercise(
        testUser._id,
        'Squat',
        equipment._id,
        [muscleGroup._id],
        undefined,
        ExerciseRepRange.Heavy
      );

      const calibration1 = await repo.insertNew(
        WorkoutExerciseCalibrationSchema.parse({
          userId: testUser._id,
          workoutExerciseId: exercise._id,
          reps: 5,
          weight: 225
        })
      );

      const calibration2 = await repo.insertNew(
        WorkoutExerciseCalibrationSchema.parse({
          userId: testUser._id,
          workoutExerciseId: exercise._id,
          reps: 8,
          weight: 185
        })
      );

      if (!calibration1 || !calibration2) {
        throw new Error('Failed to insert calibrations');
      }

      const allCalibrations = await repo.getAllForUser(testUser._id);

      expect(allCalibrations.length).toBeGreaterThanOrEqual(2);
      const ids = allCalibrations.map((cal) => cal._id);
      expect(ids).toContain(calibration1._id);
      expect(ids).toContain(calibration2._id);

      // Cleanup
      await cleanupDoc(userRepo, testUser);
    });

    it('should update a calibration', async () => {
      const testUser = await createNewTestUser();

      const muscleGroup = await createMuscleGroup(testUser._id, 'Back');
      const equipment = await createEquipmentType(testUser._id, 'Barbell');

      const exercise = await createExercise(
        testUser._id,
        'Deadlift',
        equipment._id,
        [muscleGroup._id],
        undefined,
        ExerciseRepRange.Heavy
      );

      const calibration = await repo.insertNew(
        WorkoutExerciseCalibrationSchema.parse({
          userId: testUser._id,
          workoutExerciseId: exercise._id,
          reps: 5,
          weight: 315
        })
      );

      if (!calibration) {
        throw new Error('Failed to insert calibration');
      }

      await repo.update({
        _id: calibration._id,
        weight: 335
      });

      const updated = await repo.get({ _id: calibration._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated calibration');
      }

      expect(updated.weight).toBe(335);

      // Cleanup
      await cleanupDoc(userRepo, testUser);
    });

    it('should delete a calibration', async () => {
      const testUser = await createNewTestUser();

      const muscleGroup = await createMuscleGroup(testUser._id, 'Shoulders');
      const equipment = await createEquipmentType(testUser._id, 'Barbell');

      const exercise = await createExercise(testUser._id, 'Overhead Press', equipment._id, [
        muscleGroup._id
      ]);

      const calibration = await repo.insertNew(
        WorkoutExerciseCalibrationSchema.parse({
          userId: testUser._id,
          workoutExerciseId: exercise._id,
          reps: 10,
          weight: 95
        })
      );

      if (!calibration) {
        throw new Error('Failed to insert calibration');
      }

      await repo.delete(calibration._id);

      const retrieved = await repo.get({ _id: calibration._id });
      expect(retrieved).toBeNull();
      await cleanupDoc(userRepo, testUser);
    });
  });

  describe('Validation', () => {
    it('should reject calibration with non-existent exercise', async () => {
      const testUser = await createNewTestUser();

      const fakeExerciseId = '00000000-0000-7000-8000-000000000000';
      const newCalibration = WorkoutExerciseCalibrationSchema.parse({
        userId: testUser._id,
        workoutExerciseId: fakeExerciseId,
        reps: 10,
        weight: 100
      });

      await expect(repo.insertNew(newCalibration)).rejects.toThrow(
        `Exercise with ID ${fakeExerciseId} does not exist`
      );

      await cleanupDoc(userRepo, testUser);
    });

    it('should reject invalid calibration on creation', async () => {
      const testUser = await createNewTestUser();

      const invalidCalibration = {
        userId: testUser._id
        // workoutExerciseId, reps, and weight are missing
      };

      await expect(
        repo.insertNew(invalidCalibration as unknown as WorkoutExerciseCalibration)
      ).rejects.toThrow('Schema validation failed');

      await cleanupDoc(userRepo, testUser);
    });

    it('should reject update without _id', async () => {
      await expect(
        repo.update({
          weight: 200
        })
      ).rejects.toThrow('No _id defined for WorkoutExerciseCalibration update');
    });

    it('should reject update with non-existent exercise', async () => {
      const testUser = await createNewTestUser();

      const muscleGroup = await createMuscleGroup(testUser._id, 'Arms');
      const equipment = await createEquipmentType(testUser._id, 'Dumbbell');

      const exercise = await createExercise(testUser._id, 'Bicep Curl', equipment._id, [
        muscleGroup._id
      ]);

      const calibration = await repo.insertNew(
        WorkoutExerciseCalibrationSchema.parse({
          userId: testUser._id,
          workoutExerciseId: exercise._id,
          reps: 10,
          weight: 30
        })
      );

      if (!calibration) {
        throw new Error('Failed to insert calibration');
      }

      const fakeExerciseId = '00000000-0000-7000-8000-000000000000';
      await expect(
        repo.update({
          _id: calibration._id,
          workoutExerciseId: fakeExerciseId
        })
      ).rejects.toThrow(`Exercise with ID ${fakeExerciseId} does not exist`);

      await cleanupDoc(userRepo, testUser);
    });
  });

  describe('Exercise Reference', () => {
    it('should maintain calibration when exercise is updated', async () => {
      const testUser = await createNewTestUser();

      const muscleGroup = await createMuscleGroup(testUser._id, 'Core');
      const equipment = await createEquipmentType(testUser._id, 'Bodyweight');

      const exercise = await createExercise(testUser._id, 'Plank', equipment._id, [
        muscleGroup._id
      ]);

      const calibration = await repo.insertNew(
        WorkoutExerciseCalibrationSchema.parse({
          userId: testUser._id,
          workoutExerciseId: exercise._id,
          reps: 1,
          weight: 0
        })
      );

      if (!calibration) {
        throw new Error('Failed to insert calibration');
      }

      // Update exercise
      await WorkoutExerciseRepository.getRepo().update({
        _id: exercise._id,
        exerciseName: 'Weighted Plank'
      });

      // Verify calibration still exists
      const retrievedCalibration = await repo.get({ _id: calibration._id });
      expect(retrievedCalibration).toBeTruthy();
      if (!retrievedCalibration) {
        throw new Error('Calibration should still exist');
      }
      expect(retrievedCalibration.workoutExerciseId).toBe(exercise._id);

      // Cleanup
      await cleanupDoc(userRepo, testUser);
    });
  });
});

/**
 * Create a new test user
 */
async function createNewTestUser() {
  const newUser = UserSchema.parse({
    userName: getTestUserName(`${crypto.randomUUID()}calibration`)
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
async function createMuscleGroup(userId: UUID, name: string) {
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
async function createEquipmentType(userId: UUID, title: string) {
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
) {
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
