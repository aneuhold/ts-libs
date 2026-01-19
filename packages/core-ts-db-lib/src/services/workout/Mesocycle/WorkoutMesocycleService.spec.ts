import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import { CycleType, WorkoutMesocycleSchema } from '../../../documents/workout/WorkoutMesocycle.js';
import WorkoutMesocycleService from './WorkoutMesocycleService.js';

describe('Unit Tests', () => {
  describe('generateInitialPlan', () => {
    it('should generate correct number of microcycles, sessions, exercises, and sets', () => {
      // Setup test data
      const exercises = Object.values(workoutTestUtil.STANDARD_EXERCISES);
      const calibrations = Object.values(workoutTestUtil.STANDARD_CALIBRATIONS);
      const equipment = Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES);

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 4,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [2, 5],
        plannedMicrocycleCount: 3, // 3 microcycles for simpler testing
        calibratedExercises: calibrations.map((c) => c._id)
      });

      const result = WorkoutMesocycleService.generateInitialPlan(
        mesocycle,
        calibrations,
        exercises,
        equipment
      );

      // Verify microcycles
      expect(result.microcycles?.create).toHaveLength(3);
      expect(result.microcycles?.update).toHaveLength(0);
      expect(result.microcycles?.delete).toHaveLength(0);

      // Verify sessions (4 sessions per microcycle * 3 microcycles = 12)
      expect(result.sessions?.create).toHaveLength(12);

      // Verify session exercises (4 exercises distributed across 4 sessions per microcycle)
      // Each session should have at least 1 exercise
      expect((result.sessionExercises?.create ?? []).length).toBeGreaterThan(0);

      // Verify sets exist
      expect((result.sets?.create ?? []).length).toBeGreaterThan(0);

      // Verify microcycle dates are sequential
      const microcycles = result.microcycles?.create ?? [];
      for (let i = 1; i < microcycles.length; i++) {
        const prevEnd = new Date(microcycles[i - 1].endDate);
        const currentStart = new Date(microcycles[i].startDate);
        expect(currentStart.getTime()).toBe(prevEnd.getTime());
      }

      // Print the mesocycle plan for visualization
      workoutTestUtil.printMesocyclePlan(result, exercises, calibrations);
    });

    it('should correctly apply progression formulas for sets, reps, RIR, and weights', () => {
      // Setup test data
      const equipment = Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES);
      const exercises = Object.values(workoutTestUtil.STANDARD_EXERCISES);
      const calibrations = Object.values(workoutTestUtil.STANDARD_CALIBRATIONS);

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 3,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 3,
        calibratedExercises: calibrations.map((c) => c._id)
      });

      const result = WorkoutMesocycleService.generateInitialPlan(
        mesocycle,
        calibrations,
        exercises,
        equipment
      );

      const sets = result.sets?.create ?? [];
      const sessions = result.sessions?.create ?? [];
      const microcycles = result.microcycles?.create ?? [];

      // Basic structure checks
      expect(microcycles.length).toBe(mesocycle.plannedMicrocycleCount);
      expect(sessions.length).toBe(9); // 3 sessions * 3 microcycles
      expect(sets.length).toBeGreaterThan(0); // At least some sets created

      // Test RIR progression (4 -> 3 -> 2 across microcycles 0-2)
      for (let microcycleIndex = 0; microcycleIndex < 3; microcycleIndex++) {
        const expectedRir = 4 - microcycleIndex;
        const microcycleId = microcycles[microcycleIndex]._id;
        const microcycleSessions = sessions.filter((s) => s.workoutMicrocycleId === microcycleId);
        const firstSessionId = microcycleSessions[0]._id;
        const firstSessionSets = sets.filter((s) => s.workoutSessionId === firstSessionId);

        // All sets in first session should have same RIR
        firstSessionSets.forEach((set) => {
          expect(set.plannedRir).toBe(expectedRir);
        });
      }

      // Test that weights are calculated
      sets.forEach((set) => {
        expect(set.plannedWeight).toBeGreaterThan(0);
      });

      // Test that rep ranges are respected
      sets.forEach((set) => {
        expect(set.plannedReps).toBeGreaterThanOrEqual(5);
        expect(set.plannedReps).toBeLessThanOrEqual(30); // Max for light exercises
      });

      // Print the mesocycle plan for visualization
      workoutTestUtil.printMesocyclePlan(result, exercises, calibrations);
    });
  });
});
