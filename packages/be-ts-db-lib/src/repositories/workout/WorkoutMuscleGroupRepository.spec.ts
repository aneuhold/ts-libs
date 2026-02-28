import { type WorkoutMuscleGroup } from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../test-util/projects/workout/workoutTestUtil.js';
import WorkoutMuscleGroupRepository from './WorkoutMuscleGroupRepository.js';

describe('WorkoutMuscleGroupRepository', () => {
  const repo = WorkoutMuscleGroupRepository.getRepo();

  describe('Basic CRUD Operations', () => {
    it('should insert a new muscle group', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository');

      const result = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Test Quadriceps');

      expect(result._id).toBeDefined();
      expect(result.name).toBe('Test Quadriceps');
      expect(result.userId).toBe(testUser._id);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutMuscleGroup');
    });

    it('should get all muscle groups for a user', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository');

      const muscleGroup1 = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Chest');
      const muscleGroup2 = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Back');

      const allMuscleGroups = await repo.getAllForUser(testUser._id);

      expect(allMuscleGroups.length).toBeGreaterThanOrEqual(2);
      const ids = allMuscleGroups.map((mg) => mg._id);
      expect(ids).toContain(muscleGroup1._id);
      expect(ids).toContain(muscleGroup2._id);
    });

    it('should update a muscle group', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Shoulders');

      await repo.update({
        _id: muscleGroup._id,
        name: 'Updated Shoulders'
      });

      const updated = await repo.get({ _id: muscleGroup._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated muscle group');
      }

      expect(updated.name).toBe('Updated Shoulders');
    });

    it('should delete a muscle group', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Biceps');

      await repo.delete(muscleGroup._id);

      const retrieved = await repo.get({ _id: muscleGroup._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should reject invalid muscle group on creation', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository');
      const invalidMuscleGroup = {
        userId: testUser._id
        // name is missing
      };

      await expect(
        repo.insertNew(invalidMuscleGroup as unknown as WorkoutMuscleGroup)
      ).rejects.toThrow('Schema validation failed');
    });

    it('should reject update without _id', async () => {
      await expect(
        repo.update({
          name: 'Test'
        })
      ).rejects.toThrow('No _id defined for WorkoutMuscleGroup update');
    });

    it('should reject invalid muscle group on update', async () => {
      const testUser = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id, 'Test Group');

      const update = {
        _id: muscleGroup._id,
        name: 123 // Invalid type
      };

      await expect(repo.update(update as unknown as WorkoutMuscleGroup)).rejects.toThrow(
        'Schema validation failed'
      );
    });
  });

  describe('buildMuscleGroupVolumeCTOsForUser', () => {
    it('should return empty mesocycleHistory for muscle groups with no completed mesocycles', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository.buildCTOs');
      const mg = await workoutTestUtil.insertMuscleGroup(user._id, 'Traps');

      const ctos = await repo.buildMuscleGroupVolumeCTOsForUser(user._id);
      const cto = ctos.find((c) => c._id === mg._id);

      expect(cto).toBeDefined();
      if (!cto) return;
      expect(cto.mesocycleHistory).toHaveLength(0);
    });

    it('should compute startingSetCount from the first microcycle', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository.buildCTOs');
      const mg = await workoutTestUtil.insertMuscleGroup(user._id, 'Chest');
      const eq = await workoutTestUtil.insertEquipmentType(user._id);
      const exercise = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Bench'
      });

      await workoutTestUtil.insertCompletedMesocycle(user._id, exercise, {
        microcycleCount: 3,
        setsPerMicrocycle: [2, 4, 5]
      });

      const ctos = await repo.buildMuscleGroupVolumeCTOsForUser(user._id);
      const cto = ctos.find((c) => c._id === mg._id);

      expect(cto).toBeDefined();
      if (!cto) return;
      expect(cto.mesocycleHistory).toHaveLength(1);
      expect(cto.mesocycleHistory[0].startingSetCount).toBe(2);
    });

    it('should compute peakSetCount as the max across microcycles', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository.buildCTOs');
      const mg = await workoutTestUtil.insertMuscleGroup(user._id, 'Quads');
      const eq = await workoutTestUtil.insertEquipmentType(user._id);
      const exercise = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Squat'
      });

      await workoutTestUtil.insertCompletedMesocycle(user._id, exercise, {
        microcycleCount: 3,
        setsPerMicrocycle: [3, 5, 4]
      });

      const ctos = await repo.buildMuscleGroupVolumeCTOsForUser(user._id);
      const cto = ctos.find((c) => c._id === mg._id);

      expect(cto).toBeDefined();
      if (!cto) return;
      expect(cto.mesocycleHistory[0].peakSetCount).toBe(5);
    });

    it('should compute RSM, soreness, and performance averages correctly', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository.buildCTOs');
      const mg = await workoutTestUtil.insertMuscleGroup(user._id, 'Back');
      const eq = await workoutTestUtil.insertEquipmentType(user._id);
      const exercise = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Row'
      });

      await workoutTestUtil.insertCompletedMesocycle(user._id, exercise, {
        microcycleCount: 2,
        sorenessScore: 2,
        performanceScore: 1,
        rsm: { mindMuscleConnection: 2, pump: 1, disruption: 1 }
      });

      const ctos = await repo.buildMuscleGroupVolumeCTOsForUser(user._id);
      const cto = ctos.find((c) => c._id === mg._id);
      expect(cto).toBeDefined();
      if (!cto) return;
      const history = cto.mesocycleHistory[0];

      // RSM total = 2+1+1 = 4, averaged across 2 session exercises
      expect(history.avgRsm).toBe(4);
      expect(history.avgSorenessScore).toBe(2);
      expect(history.avgPerformanceScore).toBe(1);
    });

    it('should count recoverySessionCount correctly', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository.buildCTOs');
      const mg = await workoutTestUtil.insertMuscleGroup(user._id, 'Shoulders');
      const eq = await workoutTestUtil.insertEquipmentType(user._id);
      const exercise = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Press'
      });

      await workoutTestUtil.insertCompletedMesocycle(user._id, exercise, {
        microcycleCount: 3,
        isRecoveryExercise: true
      });

      const ctos = await repo.buildMuscleGroupVolumeCTOsForUser(user._id);
      const cto = ctos.find((c) => c._id === mg._id);

      expect(cto).toBeDefined();
      if (!cto) return;
      expect(cto.mesocycleHistory[0].recoverySessionCount).toBe(3);
    });

    it('should include secondary muscle group associations', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository.buildCTOs');
      const primaryMg = await workoutTestUtil.insertMuscleGroup(user._id, 'Chest');
      const secondaryMg = await workoutTestUtil.insertMuscleGroup(user._id, 'Triceps');
      const eq = await workoutTestUtil.insertEquipmentType(user._id);
      const exercise = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [primaryMg._id],
        secondaryMuscleGroupIds: [secondaryMg._id],
        name: 'Bench'
      });

      await workoutTestUtil.insertCompletedMesocycle(user._id, exercise, {
        microcycleCount: 2,
        setsPerMicrocycle: [4, 4]
      });

      const ctos = await repo.buildMuscleGroupVolumeCTOsForUser(user._id);
      const secondaryCto = ctos.find((c) => c._id === secondaryMg._id);

      // Secondary muscle group should also have volume history
      expect(secondaryCto).toBeDefined();
      if (!secondaryCto) return;
      expect(secondaryCto.mesocycleHistory).toHaveLength(1);
      expect(secondaryCto.mesocycleHistory[0].startingSetCount).toBe(4);
    });

    it('should return null averages when RSM/soreness/performance are not recorded', async () => {
      const user = await workoutTestUtil.insertUser('WorkoutMuscleGroupRepository.buildCTOs');
      const mg = await workoutTestUtil.insertMuscleGroup(user._id, 'Calves');
      const eq = await workoutTestUtil.insertEquipmentType(user._id);
      const exercise = await workoutTestUtil.insertExercise({
        userId: user._id,
        equipmentTypeId: eq._id,
        primaryMuscleGroupIds: [mg._id],
        name: 'Calf Raise'
      });

      await workoutTestUtil.insertCompletedMesocycle(user._id, exercise, {
        microcycleCount: 2,
        sorenessScore: null,
        performanceScore: null,
        rsm: null
      });

      const ctos = await repo.buildMuscleGroupVolumeCTOsForUser(user._id);
      const cto = ctos.find((c) => c._id === mg._id);

      expect(cto).toBeDefined();
      if (!cto) return;
      expect(cto.mesocycleHistory[0].avgRsm).toBeNull();
      expect(cto.mesocycleHistory[0].avgSorenessScore).toBeNull();
      expect(cto.mesocycleHistory[0].avgPerformanceScore).toBeNull();
    });
  });
});
