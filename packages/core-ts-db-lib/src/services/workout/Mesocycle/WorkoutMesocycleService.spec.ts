import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import { CycleType, WorkoutMesocycleSchema } from '../../../documents/workout/WorkoutMesocycle.js';
import WorkoutMesocycleService from './WorkoutMesocycleService.js';

describe('Unit Tests', () => {
  describe('generateOrUpdateMesocycle', () => {
    it('should not generate any plan documents for FreeForm mesocycles', () => {
      const exercises = [workoutTestUtil.STANDARD_EXERCISES.barbellSquat];
      const calibrations = [workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat];
      const equipment = Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES);

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.FreeForm,
        plannedSessionCountPerMicrocycle: 1,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 3,
        calibratedExercises: calibrations.map((c) => c._id)
      });

      const result = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        calibrations,
        exercises,
        equipment
      );

      expect(result.microcycles?.create).toBeUndefined();
      expect(result.sessions?.create).toBeUndefined();
      expect(result.sessionExercises?.create).toBeUndefined();
      expect(result.sets?.create).toBeUndefined();
    });

    it('(Smoke) should generate correct number of microcycles, sessions, exercises, and sets for super small mesocycle', () => {
      // Setup test data - using subset of 4 exercises
      const exercises = [
        workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
        workoutTestUtil.STANDARD_EXERCISES.deadlift,
        workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise
      ];
      const calibrations = [
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
        workoutTestUtil.STANDARD_CALIBRATIONS.deadlift,
        workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise
      ];
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

      const result = WorkoutMesocycleService.generateOrUpdateMesocycle(
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
      workoutTestUtil.printMesocyclePlan(result, exercises);
    });

    it('(Smoke) should correctly apply progression formulas for sets, reps, RIR, and weights', () => {
      // Setup test data - using subset of 4 exercises
      const exercises = [
        workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
        workoutTestUtil.STANDARD_EXERCISES.cableRow,
        workoutTestUtil.STANDARD_EXERCISES.dumbbellCurl,
        workoutTestUtil.STANDARD_EXERCISES.cableTricepPushdown
      ];
      const calibrations = [
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
        workoutTestUtil.STANDARD_CALIBRATIONS.cableRow,
        workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellCurl,
        workoutTestUtil.STANDARD_CALIBRATIONS.cableTricepPushdown
      ];
      const equipment = Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES);

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 3,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 3,
        calibratedExercises: calibrations.map((c) => c._id)
      });

      const result = WorkoutMesocycleService.generateOrUpdateMesocycle(
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

      // Test RIR progression (4 -> 3 across accumulation microcycles, null for deload)
      const deloadIndex = microcycles.length - 1;
      for (let microcycleIndex = 0; microcycleIndex < 3; microcycleIndex++) {
        const expectedRir = microcycleIndex === deloadIndex ? null : 4 - microcycleIndex;
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
      workoutTestUtil.printMesocyclePlan(result, exercises);
    });

    it('(Smoke) should handle large mesocycle with 6 accumulation + 1 deload microcycles', () => {
      // Setup test data - using all 10 exercises
      const exercises = Object.values(workoutTestUtil.STANDARD_EXERCISES);
      const calibrations = Object.values(workoutTestUtil.STANDARD_CALIBRATIONS);
      const equipment = Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES);

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 6,
        plannedMicrocycleLengthInDays: 8,
        plannedMicrocycleRestDays: [4, 5], // 2 consecutive rest days
        plannedMicrocycleCount: 7, // 6 accumulation + 1 deload
        calibratedExercises: calibrations.map((c) => c._id)
      });

      const result = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        calibrations,
        exercises,
        equipment
      );

      // Verify microcycles
      expect(result.microcycles?.create).toHaveLength(7);
      expect(result.microcycles?.update).toHaveLength(0);
      expect(result.microcycles?.delete).toHaveLength(0);

      // Verify sessions (6 sessions per microcycle * 7 microcycles = 42)
      expect(result.sessions?.create).toHaveLength(42);

      // Verify session exercises exist
      // With 10 exercises and 6 sessions per microcycle, duplication/grouping happens
      expect((result.sessionExercises?.create ?? []).length).toBeGreaterThan(0);

      // Verify sets exist
      expect((result.sets?.create ?? []).length).toBeGreaterThan(0);

      // Verify microcycle dates are sequential and correct length
      const microcycles = result.microcycles?.create ?? [];
      for (let i = 0; i < microcycles.length; i++) {
        const start = new Date(microcycles[i].startDate);
        const end = new Date(microcycles[i].endDate);
        const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        expect(durationDays).toBeGreaterThan(7); // 8 day microcycles (allow for DST)

        // Verify sequential dates
        if (i > 0) {
          const prevEnd = new Date(microcycles[i - 1].endDate);
          expect(start.getTime()).toBe(prevEnd.getTime());
        }
      }

      // Verify rest days are respected in sessions
      const sessions = result.sessions?.create ?? [];
      microcycles.forEach((microcycle) => {
        const microSessions = sessions.filter((s) => s.workoutMicrocycleId === microcycle._id);

        microSessions.forEach((session) => {
          const dayOfMicrocycle = Math.round(
            (session.startTime.getTime() - microcycle.startDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          // Sessions should not be on rest days (4 and 5)
          expect([4, 5]).not.toContain(dayOfMicrocycle);
        });
      });

      // Print the mesocycle plan for visualization
      workoutTestUtil.printMesocyclePlan(result, exercises);
    });

    it('should pass existing documents through without regenerating when all are complete', () => {
      const exercises = [
        workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress
      ];
      const calibrations = [
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress
      ];
      const equipment = Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES);

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 2,
        calibratedExercises: calibrations.map((c) => c._id)
      });

      // Generate initial plan
      const initialResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        calibrations,
        exercises,
        equipment
      );

      // Mark ALL sessions as complete
      const sessionsAllComplete = (initialResult.sessions?.create ?? []).map((s) => ({
        ...s,
        complete: true
      }));

      // Regenerate - should not create, update, or delete anything
      const regenResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        calibrations,
        exercises,
        equipment,
        initialResult.microcycles?.create ?? [],
        sessionsAllComplete,
        initialResult.sessionExercises?.create ?? [],
        initialResult.sets?.create ?? []
      );

      // No new microcycles to create (all are already complete)
      expect(regenResult.microcycles?.create).toHaveLength(0);
      expect(regenResult.microcycles?.delete).toHaveLength(0);
      expect(regenResult.sessions?.create).toHaveLength(0);
      expect(regenResult.sessions?.delete).toHaveLength(0);
    });

    it('should incrementally generate new microcycles after existing complete ones', () => {
      const exercises = [
        workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress
      ];
      const calibrations = [
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress
      ];
      const equipment = Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES);

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 4, // Will generate in 2 batches
        calibratedExercises: calibrations.map((c) => c._id)
      });

      // Generate initial plan with only 2 microcycles
      const initialMesocycle = { ...mesocycle, plannedMicrocycleCount: 2 };
      const initialResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        initialMesocycle,
        calibrations,
        exercises,
        equipment
      );

      expect(initialResult.microcycles?.create).toHaveLength(2);
      expect(initialResult.sessions?.create).toHaveLength(4); // 2 sessions per microcycle

      // Mark all sessions as complete
      const sessionsComplete = (initialResult.sessions?.create ?? []).map((s) => ({
        ...s,
        complete: true
      }));

      // Now generate with the full 4 microcycles - should create 2 more
      const extendedResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        calibrations,
        exercises,
        equipment,
        initialResult.microcycles?.create ?? [],
        sessionsComplete,
        initialResult.sessionExercises?.create ?? [],
        initialResult.sets?.create ?? []
      );

      // Should create 2 new microcycles (4 total - 2 existing)
      expect(extendedResult.microcycles?.create).toHaveLength(2);
      expect(extendedResult.microcycles?.delete).toHaveLength(0);
      // Should create 4 new sessions (2 per new microcycle)
      expect(extendedResult.sessions?.create).toHaveLength(4);

      // Verify dates are sequential from last existing microcycle
      const initialMicrocycles = initialResult.microcycles?.create ?? [];
      const extendedMicrocycles = extendedResult.microcycles?.create ?? [];
      expect(initialMicrocycles).toHaveLength(2);
      expect(extendedMicrocycles).toHaveLength(2);
      const lastExistingMicrocycle = initialMicrocycles[1];
      const firstNewMicrocycle = extendedMicrocycles[0];
      expect(new Date(firstNewMicrocycle.startDate).getTime()).toBe(
        new Date(lastExistingMicrocycle.endDate).getTime()
      );
    });

    it('should clean up incomplete microcycle that has not started', () => {
      const exercises = [
        workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress
      ];
      const calibrations = [
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress
      ];
      const equipment = Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES);

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 3,
        calibratedExercises: calibrations.map((c) => c._id)
      });

      // Generate initial plan
      const initialResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        calibrations,
        exercises,
        equipment
      );

      // Mark first microcycle's sessions as complete
      const initialMicrocycles = initialResult.microcycles?.create ?? [];
      const microcycle1Sessions = (initialResult.sessions?.create ?? []).filter(
        (s) => s.workoutMicrocycleId === initialMicrocycles[0]?._id
      );
      const sessionsPartialComplete = (initialResult.sessions?.create ?? []).map((s) => ({
        ...s,
        complete: microcycle1Sessions.includes(s)
      }));

      // Regenerate - should clean up microcycles 2 and 3, keep microcycle 1
      const regenResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        calibrations,
        exercises,
        equipment,
        initialResult.microcycles?.create ?? [],
        sessionsPartialComplete,
        initialResult.sessionExercises?.create ?? [],
        initialResult.sets?.create ?? []
      );

      // Should delete 2 incomplete microcycles
      expect(regenResult.microcycles?.delete).toHaveLength(2);
      // Should create 2 new microcycles
      expect(regenResult.microcycles?.create).toHaveLength(2);

      // Should delete sessions, exercises, and sets for deleted microcycles
      const deletedMicrocycleIds = new Set(regenResult.microcycles?.delete ?? []);
      const originalSessionsToDelete = (initialResult.sessions?.create ?? []).filter(
        (s) => s.workoutMicrocycleId && deletedMicrocycleIds.has(s.workoutMicrocycleId)
      );
      expect(regenResult.sessions?.delete).toHaveLength(originalSessionsToDelete.length);
    });

    it('should clean up microcycle with no sessions', () => {
      const exercises = [
        workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress
      ];
      const calibrations = [
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress
      ];
      const equipment = Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES);

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 2,
        calibratedExercises: calibrations.map((c) => c._id)
      });

      // Generate initial plan
      const initialResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        calibrations,
        exercises,
        equipment
      );

      // Create a microcycle with no sessions (empty sessionOrder)
      const microcycles = initialResult.microcycles?.create ?? [];
      const incompleteMicrocycle = { ...microcycles[1], sessionOrder: [] };
      const modifiedMicrocycles = [microcycles[0], incompleteMicrocycle];

      // Mark first microcycle as complete
      const sessionsComplete = (initialResult.sessions?.create ?? [])
        .filter((s) => s.workoutMicrocycleId === microcycles[0]?._id)
        .map((s) => ({ ...s, complete: true }));

      // Regenerate - should clean up the empty microcycle
      const regenResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        calibrations,
        exercises,
        equipment,
        modifiedMicrocycles,
        sessionsComplete,
        initialResult.sessionExercises?.create ?? [],
        initialResult.sets?.create ?? []
      );

      // Should delete the incomplete microcycle
      const deletedMicrocycleIds = regenResult.microcycles?.delete ?? [];
      expect(deletedMicrocycleIds).toHaveLength(1);
      expect(deletedMicrocycleIds[0]).toBe(incompleteMicrocycle._id);
      // Should create a new microcycle to replace it
      expect(regenResult.microcycles?.create).toHaveLength(1);
    });

    it('should throw error when incomplete microcycle has already started', () => {
      const exercises = [
        workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
        workoutTestUtil.STANDARD_EXERCISES.deadlift
      ];
      const calibrations = [
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
        workoutTestUtil.STANDARD_CALIBRATIONS.deadlift
      ];
      const equipment = Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES);

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 3,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 2,
        calibratedExercises: calibrations.map((c) => c._id)
      });

      // Generate initial plan
      const initialResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        calibrations,
        exercises,
        equipment
      );

      // Mark all sessions of the first microcycle as complete, and only the first session
      // of the second microcycle as complete.
      // This simulates a microcycle that has started but isn't finished
      const initialMicrocycles = initialResult.microcycles?.create ?? [];
      const microcycle1Sessions = (initialResult.sessions?.create ?? []).filter(
        (s) => s.workoutMicrocycleId === initialMicrocycles[0]?._id
      );
      const microcycle2Sessions = (initialResult.sessions?.create ?? []).filter(
        (s) => s.workoutMicrocycleId === initialMicrocycles[1]?._id
      );
      const firstSessionOfMicrocycle2 = microcycle2Sessions[0];
      const sessionsPartialComplete = (initialResult.sessions?.create ?? []).map((s) => ({
        ...s,
        complete:
          microcycle1Sessions.some((m1s) => m1s._id === s._id) ||
          s._id === firstSessionOfMicrocycle2._id
      }));

      // Attempt to regenerate - should throw error
      expect(() => {
        WorkoutMesocycleService.generateOrUpdateMesocycle(
          mesocycle,
          calibrations,
          exercises,
          equipment,
          initialResult.microcycles?.create ?? [],
          sessionsPartialComplete,
          initialResult.sessionExercises?.create ?? [],
          initialResult.sets?.create ?? []
        );
      }).toThrow(/has started but is not complete/);
    });

    it('should use provided startDate for first microcycle when given', () => {
      const exercises = [
        workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress
      ];
      const calibrations = [
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress
      ];
      const equipment = Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES);

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 3,
        calibratedExercises: calibrations.map((c) => c._id)
      });

      const customStartDate = new Date('2026-03-01T00:00:00.000Z');

      const result = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        calibrations,
        exercises,
        equipment,
        [],
        [],
        [],
        [],
        customStartDate
      );

      const microcycles = result.microcycles?.create ?? [];
      expect(microcycles).toHaveLength(3);

      // First microcycle should start at the provided date
      expect(new Date(microcycles[0].startDate).getTime()).toBe(customStartDate.getTime());

      // Subsequent microcycles should chain sequentially
      for (let i = 1; i < microcycles.length; i++) {
        const prevEnd = new Date(microcycles[i - 1].endDate);
        const currentStart = new Date(microcycles[i].startDate);
        expect(currentStart.getTime()).toBe(prevEnd.getTime());
      }
    });

    it('should default to current date when startDate is not provided', () => {
      const exercises = [
        workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress
      ];
      const calibrations = [
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress
      ];
      const equipment = Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES);

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 2,
        calibratedExercises: calibrations.map((c) => c._id)
      });

      const before = Date.now();
      const result = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        calibrations,
        exercises,
        equipment
      );
      const after = Date.now();

      const microcycles = result.microcycles?.create ?? [];
      expect(microcycles).toHaveLength(2);

      // First microcycle's start date should be approximately now
      const firstStart = new Date(microcycles[0].startDate).getTime();
      expect(firstStart).toBeGreaterThanOrEqual(before);
      expect(firstStart).toBeLessThanOrEqual(after);
    });

    it('should clean up all associated documents when deleting incomplete microcycles', () => {
      const exercises = [
        workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress
      ];
      const calibrations = [
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
        workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress
      ];
      const equipment = Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES);

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 3,
        calibratedExercises: calibrations.map((c) => c._id)
      });

      // Generate initial plan
      const initialResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        calibrations,
        exercises,
        equipment
      );

      // Mark only first microcycle as complete
      const initialMicrocycles = initialResult.microcycles?.create ?? [];
      const microcycle1Sessions = (initialResult.sessions?.create ?? []).filter(
        (s) => s.workoutMicrocycleId === initialMicrocycles[0]?._id
      );
      const sessionsComplete = (initialResult.sessions?.create ?? []).map((s) => ({
        ...s,
        complete: microcycle1Sessions.includes(s)
      }));

      // Get counts before regeneration
      const microcycle2And3Ids = new Set([initialMicrocycles[1]._id, initialMicrocycles[2]._id]);
      const sessionsToDelete = (initialResult.sessions?.create ?? []).filter(
        (s) => s.workoutMicrocycleId && microcycle2And3Ids.has(s.workoutMicrocycleId)
      );
      const sessionIdsToDelete = new Set(sessionsToDelete.map((s) => s._id));
      const sessionExercisesToDelete = (initialResult.sessionExercises?.create ?? []).filter((se) =>
        sessionIdsToDelete.has(se.workoutSessionId)
      );
      const sessionExerciseIdsToDelete = new Set(sessionExercisesToDelete.map((se) => se._id));
      const setsToDelete = (initialResult.sets?.create ?? []).filter((set) =>
        sessionExerciseIdsToDelete.has(set.workoutSessionExerciseId)
      );

      // Regenerate
      const regenResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        calibrations,
        exercises,
        equipment,
        initialResult.microcycles?.create ?? [],
        sessionsComplete,
        initialResult.sessionExercises?.create ?? [],
        initialResult.sets?.create ?? []
      );

      // Verify all associated documents are deleted
      expect(regenResult.microcycles?.delete).toHaveLength(2);
      expect(regenResult.sessions?.delete).toHaveLength(sessionsToDelete.length);
      expect(regenResult.sessionExercises?.delete).toHaveLength(sessionExercisesToDelete.length);
      expect(regenResult.sets?.delete).toHaveLength(setsToDelete.length);

      // Verify cascading deletion: all deleted sessions belong to deleted microcycles
      const deletedSessionIds = regenResult.sessions?.delete ?? [];
      deletedSessionIds.forEach((sessionId) => {
        const session = sessionsToDelete.find((s) => s._id === sessionId);
        expect(session).toBeDefined();
        if (session && session.workoutMicrocycleId) {
          expect(microcycle2And3Ids.has(session.workoutMicrocycleId)).toBe(true);
        }
      });

      // Verify cascading deletion: all deleted session exercises belong to deleted sessions
      const deletedSessionExerciseIds = regenResult.sessionExercises?.delete ?? [];
      deletedSessionExerciseIds.forEach((seId) => {
        const se = sessionExercisesToDelete.find((item) => item._id === seId);
        expect(se).toBeDefined();
        if (se) {
          expect(sessionIdsToDelete.has(se.workoutSessionId)).toBe(true);
        }
      });

      // Verify cascading deletion: all deleted sets belong to deleted session exercises
      const deletedSetIds = regenResult.sets?.delete ?? [];
      deletedSetIds.forEach((setId) => {
        const set = setsToDelete.find((item) => item._id === setId);
        expect(set).toBeDefined();
        if (set) {
          expect(sessionExerciseIdsToDelete.has(set.workoutSessionExerciseId)).toBe(true);
        }
      });
    });
  });
});
