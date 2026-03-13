import {
  ExerciseRepRange,
  WorkoutExerciseCalibrationService,
  WorkoutExerciseSchema,
  type WorkoutExercise
} from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../test-util/projects/workout/workoutTestUtil.js';
import WorkoutExerciseCalibrationRepository from './WorkoutExerciseCalibrationRepository.js';
import WorkoutExerciseRepository from './WorkoutExerciseRepository.js';

describe('WorkoutExerciseRepository', () => {
  const repo = WorkoutExerciseRepository.getRepo();
  const calibrationRepo = WorkoutExerciseCalibrationRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new exercise with muscle groups and equipment', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const primaryMuscleGroup = await workoutTestUtil.insertMuscleGroup(
        testUser._id,
        'Quadriceps'
      );
      const secondaryMuscleGroup = await workoutTestUtil.insertMuscleGroup(
        testUser._id,
        'Hamstrings'
      );
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Barbell');

      const result = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: equipment._id,
        primaryMuscleGroupIds: [primaryMuscleGroup._id],
        secondaryMuscleGroupIds: [secondaryMuscleGroup._id],
        name: 'Squat',
        repRange: ExerciseRepRange.Heavy
      });

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
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Core');
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Bodyweight');

      const result = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: equipment._id,
        primaryMuscleGroupIds: [muscleGroup._id],
        name: 'Plank'
      });

      expect(result._id).toBeDefined();
      expect(result.exerciseName).toBe('Plank');
      expect(result.primaryMuscleGroups).toHaveLength(1);
      expect(result.secondaryMuscleGroups).toHaveLength(0);
    });

    it('should get all exercises for a user', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Chest');
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Barbell');

      const exercise1 = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: equipment._id,
        primaryMuscleGroupIds: [muscleGroup._id],
        name: 'Bench Press'
      });
      const exercise2 = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: equipment._id,
        primaryMuscleGroupIds: [muscleGroup._id],
        name: 'Incline Press'
      });

      const allExercises = await repo.getAllForUser(testUser._id);

      expect(allExercises.length).toBeGreaterThanOrEqual(2);
      const ids = allExercises.map((ex) => ex._id);
      expect(ids).toContain(exercise1._id);
      expect(ids).toContain(exercise2._id);
    });

    it('should update an exercise', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Back');
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Bodyweight');

      const exercise = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: equipment._id,
        primaryMuscleGroupIds: [muscleGroup._id],
        name: 'Pull Up'
      });

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
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Shoulders');
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Barbell');

      const exercise = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: equipment._id,
        primaryMuscleGroupIds: [muscleGroup._id],
        name: 'Overhead Press'
      });

      await repo.delete(exercise._id);

      const retrieved = await repo.get({ _id: exercise._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should reject exercise with non-existent muscle group', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Barbell');

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
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Legs');

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
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');

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
      const testUser = await workoutTestUtil.insertUser('WorkoutExerciseRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Arms');
      const equipment = await workoutTestUtil.insertEquipmentType(testUser._id, 'Dumbbell');

      const exercise = await workoutTestUtil.insertExercise({
        userId: testUser._id,
        equipmentTypeId: equipment._id,
        primaryMuscleGroupIds: [muscleGroup._id],
        name: 'Bicep Curl'
      });

      const calibration = await workoutTestUtil.insertCalibration({
        userId: testUser._id,
        exerciseId: exercise._id,
        reps: 10,
        weight: 25
      });

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

  describe('buildExerciseCTOsForUser', () => {
    it('should return CTO with correct equipmentType', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutExerciseRepository.buildCTOs');
      const mg = await workoutTestUtil.insertMuscleGroup(user._id, 'Chest');
      const eq = await workoutTestUtil.insertEquipmentType(user._id, 'Barbell');
      const exercise = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Bench Press'
      });

      const ctos = await repo.buildExerciseCTOsForUser(user._id);

      const cto = ctos.find((c) => c._id === exercise._id);
      expect(cto).toBeDefined();
      if (!cto) return;
      expect(cto.equipmentType._id).toBe(eq._id);
      expect(cto.equipmentType.title).toBe('Barbell');
    });

    it('should return bestCalibration as the calibration with highest 1RM', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutExerciseRepository.buildCTOs');
      const mg = await workoutTestUtil.insertMuscleGroup(user._id, 'Quads');
      const eq = await workoutTestUtil.insertEquipmentType(user._id, 'Barbell');
      const exercise = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Squat'
      });

      const cal1 = await workoutTestUtil.insertCalibration({
        userId: user._id,
        exerciseId: exercise._id,
        weight: 100,
        reps: 8
      });
      const cal2 = await workoutTestUtil.insertCalibration({
        userId: user._id,
        exerciseId: exercise._id,
        weight: 120,
        reps: 6
      });

      const cal1_1rm = WorkoutExerciseCalibrationService.get1RM(cal1);
      const cal2_1rm = WorkoutExerciseCalibrationService.get1RM(cal2);
      const expectedBestId = cal2_1rm > cal1_1rm ? cal2._id : cal1._id;

      const ctos = await repo.buildExerciseCTOsForUser(user._id);
      const cto = ctos.find((c) => c._id === exercise._id);

      expect(cto).toBeDefined();
      if (!cto) return;
      expect(cto.bestCalibration).not.toBeNull();
      if (!cto.bestCalibration) return;
      expect(cto.bestCalibration._id).toBe(expectedBestId);
    });

    it('should return bestSet as the set with highest 1RM among completed sets', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutExerciseRepository.buildCTOs');
      const mg = await workoutTestUtil.insertMuscleGroup(user._id, 'Chest');
      const eq = await workoutTestUtil.insertEquipmentType(user._id, 'Barbell');
      const exercise = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Bench'
      });

      // Session 1: lighter sets
      await workoutTestUtil.insertSessionHierarchy(user._id, exercise, {
        actualWeight: 80,
        actualReps: 10,
        startTime: new Date('2025-01-01')
      });

      // Session 2: heavier sets (higher 1RM)
      const { sets: heavySets } = await workoutTestUtil.insertSessionHierarchy(user._id, exercise, {
        actualWeight: 100,
        actualReps: 8,
        startTime: new Date('2025-01-08')
      });

      const ctos = await repo.buildExerciseCTOsForUser(user._id);
      const cto = ctos.find((c) => c._id === exercise._id);

      expect(cto).toBeDefined();
      if (!cto) return;
      expect(cto.bestSet).not.toBeNull();
      if (!cto.bestSet) return;
      // The best set should be one of the heavier sets
      expect(heavySets.map((s) => s._id)).toContain(cto.bestSet._id);
    });

    it('should return lastSessionExercise from the most recent completed non-deload session', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutExerciseRepository.buildCTOs');
      const mg = await workoutTestUtil.insertMuscleGroup(user._id, 'Back');
      const eq = await workoutTestUtil.insertEquipmentType(user._id, 'Cable');
      const exercise = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Lat Pulldown'
      });

      // Older completed session
      await workoutTestUtil.insertSessionHierarchy(user._id, exercise, {
        startTime: new Date('2025-01-01'),
        complete: true,
        plannedRir: 2
      });

      // More recent completed session
      const { sessionExercise: recentSE } = await workoutTestUtil.insertSessionHierarchy(
        user._id,
        exercise,
        {
          startTime: new Date('2025-01-08'),
          complete: true,
          plannedRir: 3
        }
      );

      const ctos = await repo.buildExerciseCTOsForUser(user._id);
      const cto = ctos.find((c) => c._id === exercise._id);

      expect(cto).toBeDefined();
      if (!cto) return;
      expect(cto.lastSessionExercise).not.toBeNull();
      if (!cto.lastSessionExercise) return;
      expect(cto.lastSessionExercise._id).toBe(recentSE._id);
    });

    it('should exclude deload sessions from lastSessionExercise', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutExerciseRepository.buildCTOs');
      const mg = await workoutTestUtil.insertMuscleGroup(user._id, 'Shoulders');
      const eq = await workoutTestUtil.insertEquipmentType(user._id, 'Dumbbell');
      const exercise = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Lateral Raise'
      });

      // Older accumulation session
      const { sessionExercise: accumSE } = await workoutTestUtil.insertSessionHierarchy(
        user._id,
        exercise,
        {
          startTime: new Date('2025-01-01'),
          complete: true,
          plannedRir: 2
        }
      );

      // More recent deload session (all sets have plannedRir === null)
      await workoutTestUtil.insertSessionHierarchy(user._id, exercise, {
        startTime: new Date('2025-01-08'),
        complete: true,
        plannedRir: null
      });

      const ctos = await repo.buildExerciseCTOsForUser(user._id);
      const cto = ctos.find((c) => c._id === exercise._id);

      expect(cto).toBeDefined();
      if (!cto) return;
      expect(cto.lastSessionExercise).not.toBeNull();
      if (!cto.lastSessionExercise) return;
      // Should pick the accumulation session, not the deload
      expect(cto.lastSessionExercise._id).toBe(accumSE._id);
    });

    it('should return all lastSessionSets in setOrder with correct count and order', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutExerciseRepository.buildCTOs');
      const mg = await workoutTestUtil.insertMuscleGroup(user._id, 'Chest');
      const eq = await workoutTestUtil.insertEquipmentType(user._id, 'Barbell');
      const exercise = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Bench Press'
      });

      const { sessionExercise, sets } = await workoutTestUtil.insertSessionHierarchy(
        user._id,
        exercise,
        {
          startTime: new Date('2025-01-08'),
          complete: true,
          setCount: 3
        }
      );

      const ctos = await repo.buildExerciseCTOsForUser(user._id);
      const cto = ctos.find((c) => c._id === exercise._id);

      expect(cto).toBeDefined();
      if (!cto) return;

      // All 3 sets should be present
      expect(cto.lastSessionSets).toHaveLength(3);

      // IDs should match setOrder exactly (preserving order)
      const returnedIds = cto.lastSessionSets.map((s) => s._id);
      expect(returnedIds).toEqual(sessionExercise.setOrder);

      // Each returned set should match the inserted set at that position
      for (let i = 0; i < sets.length; i++) {
        expect(cto.lastSessionSets[i]._id).toBe(sets[i]._id);
      }
    });

    it('should return empty lastSessionSets and null fields when exercise has no data', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutExerciseRepository.buildCTOs');
      const mg = await workoutTestUtil.insertMuscleGroup(user._id, 'Abs');
      const eq = await workoutTestUtil.insertEquipmentType(user._id, 'Bodyweight');
      const exercise = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Crunch'
      });

      const ctos = await repo.buildExerciseCTOsForUser(user._id);
      const cto = ctos.find((c) => c._id === exercise._id);

      expect(cto).toBeDefined();
      if (!cto) return;
      expect(cto.bestCalibration).toBeNull();
      expect(cto.bestSet).toBeNull();
      expect(cto.lastSessionExercise).toBeNull();
      expect(cto.lastSessionSets).toEqual([]);
    });

    it('should return multiple exercises correctly in one call', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutExerciseRepository.buildCTOs');
      const mg = await workoutTestUtil.insertMuscleGroup(user._id, 'Legs');
      const eq = await workoutTestUtil.insertEquipmentType(user._id, 'Barbell');
      const ex1 = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Squat'
      });
      const ex2 = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Deadlift'
      });

      await workoutTestUtil.insertCalibration({
        userId: user._id,
        exerciseId: ex1._id,
        weight: 100,
        reps: 8
      });
      await workoutTestUtil.insertCalibration({
        userId: user._id,
        exerciseId: ex2._id,
        weight: 120,
        reps: 5
      });

      const ctos = await repo.buildExerciseCTOsForUser(user._id);

      expect(ctos.length).toBeGreaterThanOrEqual(2);
      const ids = ctos.map((c) => c._id);
      expect(ids).toContain(ex1._id);
      expect(ids).toContain(ex2._id);

      const cto1 = ctos.find((c) => c._id === ex1._id);
      const cto2 = ctos.find((c) => c._id === ex2._id);
      expect(cto1).toBeDefined();
      expect(cto2).toBeDefined();
      if (!cto1 || !cto2) return;
      expect(cto1.bestCalibration).not.toBeNull();
      expect(cto2.bestCalibration).not.toBeNull();
    });
  });
});
