import { DateService } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import { CycleType, WorkoutMesocycleSchema } from '../../../documents/workout/WorkoutMesocycle.js';
import type { WorkoutMicrocycle } from '../../../documents/workout/WorkoutMicrocycle.js';
import type { WorkoutSessionExercise } from '../../../documents/workout/WorkoutSessionExercise.js';
import type { WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import WorkoutMesocycleService from './WorkoutMesocycleService.js';
import {
  WorkoutDeloadSeverity,
  WorkoutDeloadTriggerRule
} from './WorkoutMesocycleService.types.js';

describe('Unit Tests', () => {
  describe('generateOrUpdateMesocycle', () => {
    it('should not generate any plan documents for FreeForm mesocycles', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.FreeForm,
        plannedSessionCountPerMicrocycle: 1,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 3,
        calibratedExercises: exerciseCTOs.flatMap((c) =>
          c.bestCalibration ? [c.bestCalibration._id] : []
        )
      });

      const result = WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, exerciseCTOs);

      expect(result.microcycles?.create).toBeUndefined();
      expect(result.sessions?.create).toBeUndefined();
      expect(result.sessionExercises?.create).toBeUndefined();
      expect(result.sets?.create).toBeUndefined();
    });

    it('(Smoke) should generate correct number of microcycles, sessions, exercises, and sets for super small mesocycle', () => {
      // Setup test data - using subset of 4 exercises
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.deadlift,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.deadlift,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell
        })
      ];

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 4,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [2, 5],
        plannedMicrocycleCount: 3, // 3 microcycles for simpler testing
        calibratedExercises: exerciseCTOs.flatMap((c) =>
          c.bestCalibration ? [c.bestCalibration._id] : []
        )
      });

      const result = WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, exerciseCTOs);

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
      workoutTestUtil.printMesocyclePlan(result, exerciseCTOs);
    });

    it('(Smoke) should correctly apply progression formulas for sets, reps, RIR, and weights', () => {
      // Setup test data - using subset of 4 exercises
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.cableRow,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.cableRow,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.cable
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.dumbbellCurl,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellCurl,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.cableTricepPushdown,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.cableTricepPushdown,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.cable
        })
      ];

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 3,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 3,
        calibratedExercises: exerciseCTOs.flatMap((c) =>
          c.bestCalibration ? [c.bestCalibration._id] : []
        )
      });

      const result = WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, exerciseCTOs);

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
      workoutTestUtil.printMesocyclePlan(result, exerciseCTOs);
    });

    it('(Smoke) should handle large mesocycle with 6 accumulation + 1 deload microcycles', () => {
      // Setup test data - using all standard exercises as CTOs
      const exerciseCTOs = workoutTestUtil.STANDARD_EXERCISE_CTOS;

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 6,
        plannedMicrocycleLengthInDays: 8,
        plannedMicrocycleRestDays: [4, 5], // 2 consecutive rest days
        plannedMicrocycleCount: 7, // 6 accumulation + 1 deload
        calibratedExercises: exerciseCTOs.flatMap((c) =>
          c.bestCalibration ? [c.bestCalibration._id] : []
        )
      });

      const result = WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, exerciseCTOs);

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
        const durationDays = DateService.getCalendarDaysBetween(
          microcycles[i].startDate,
          microcycles[i].endDate
        );
        expect(durationDays).toBeGreaterThanOrEqual(7); // 8 day microcycles (allow for DST)

        // Verify sequential dates
        if (i > 0) {
          expect(microcycles[i].startDate.getTime()).toBe(microcycles[i - 1].endDate.getTime());
        }
      }

      // Verify rest days are respected in sessions
      const sessions = result.sessions?.create ?? [];
      microcycles.forEach((microcycle) => {
        const microSessions = sessions.filter((s) => s.workoutMicrocycleId === microcycle._id);

        microSessions.forEach((session) => {
          // Check that the session is not on a rest day by comparing dates directly
          const restDay4 = DateService.addDays(microcycle.startDate, 4);
          const restDay5 = DateService.addDays(microcycle.startDate, 5);
          expect(DateService.datesAreOnSameDay(session.startTime, restDay4)).toBe(false);
          expect(DateService.datesAreOnSameDay(session.startTime, restDay5)).toBe(false);
        });
      });

      // Print the mesocycle plan for visualization
      workoutTestUtil.printMesocyclePlan(result, exerciseCTOs);
    });

    it('should pass existing documents through without regenerating when all are complete', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 2,
        calibratedExercises: exerciseCTOs.flatMap((c) =>
          c.bestCalibration ? [c.bestCalibration._id] : []
        )
      });

      // Generate initial plan
      const initialResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        exerciseCTOs
      );

      // Mark ALL sessions as complete
      const sessionsAllComplete = (initialResult.sessions?.create ?? []).map((s) => ({
        ...s,
        complete: true
      }));

      // Regenerate - should not create, update, or delete anything
      const regenResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        exerciseCTOs,
        [],
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
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 4, // Will generate in 2 batches
        calibratedExercises: exerciseCTOs.flatMap((c) =>
          c.bestCalibration ? [c.bestCalibration._id] : []
        )
      });

      // Generate initial plan with only 2 microcycles
      const initialMesocycle = { ...mesocycle, plannedMicrocycleCount: 2 };
      const initialResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        initialMesocycle,
        exerciseCTOs
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
        exerciseCTOs,
        [],
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
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 3,
        calibratedExercises: exerciseCTOs.flatMap((c) =>
          c.bestCalibration ? [c.bestCalibration._id] : []
        )
      });

      // Generate initial plan
      const initialResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        exerciseCTOs
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
        exerciseCTOs,
        [],
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
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 2,
        calibratedExercises: exerciseCTOs.flatMap((c) =>
          c.bestCalibration ? [c.bestCalibration._id] : []
        )
      });

      // Generate initial plan
      const initialResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        exerciseCTOs
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
        exerciseCTOs,
        [],
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

    it('should preserve microcycles with completedDate set even when sessions are not all complete', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 3,
        calibratedExercises: exerciseCTOs.flatMap((c) =>
          c.bestCalibration ? [c.bestCalibration._id] : []
        )
      });

      // Generate initial plan
      const initialResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        exerciseCTOs
      );

      const initialMicrocycles = initialResult.microcycles?.create ?? [];

      // Set completedDate on first microcycle WITHOUT marking sessions complete
      initialMicrocycles[0].completedDate = new Date();

      // Regenerate — microcycle 0 should be preserved thanks to completedDate,
      // microcycles 1 and 2 (no completedDate, sessions incomplete) should be cleaned up
      const regenResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        exerciseCTOs,
        [],
        initialMicrocycles,
        initialResult.sessions?.create ?? [],
        initialResult.sessionExercises?.create ?? [],
        initialResult.sets?.create ?? []
      );

      // Microcycle 0 should NOT be deleted
      const deletedIds = regenResult.microcycles?.delete ?? [];
      expect(deletedIds).not.toContain(initialMicrocycles[0]._id);

      // Microcycles 1 and 2 should be deleted and regenerated
      expect(deletedIds).toHaveLength(2);
      expect(deletedIds).toContain(initialMicrocycles[1]._id);
      expect(deletedIds).toContain(initialMicrocycles[2]._id);
      expect(regenResult.microcycles?.create).toHaveLength(2);
    });

    it('should throw error when incomplete microcycle has already started', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.deadlift,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.deadlift,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 3,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 2,
        calibratedExercises: exerciseCTOs.flatMap((c) =>
          c.bestCalibration ? [c.bestCalibration._id] : []
        )
      });

      // Generate initial plan
      const initialResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        exerciseCTOs
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
          exerciseCTOs,
          [],
          initialResult.microcycles?.create ?? [],
          sessionsPartialComplete,
          initialResult.sessionExercises?.create ?? [],
          initialResult.sets?.create ?? []
        );
      }).toThrow(/has started but is not complete/);
    });

    it('should use provided startDate for first microcycle when given', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 3,
        calibratedExercises: exerciseCTOs.flatMap((c) =>
          c.bestCalibration ? [c.bestCalibration._id] : []
        )
      });

      const customStartDate = new Date('2026-03-01T00:00:00.000Z');

      const result = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        exerciseCTOs,
        [],
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
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 2,
        calibratedExercises: exerciseCTOs.flatMap((c) =>
          c.bestCalibration ? [c.bestCalibration._id] : []
        )
      });

      const before = Date.now();
      const result = WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, exerciseCTOs);
      const after = Date.now();

      const microcycles = result.microcycles?.create ?? [];
      expect(microcycles).toHaveLength(2);

      // First microcycle's start date should be approximately now
      const firstStart = new Date(microcycles[0].startDate).getTime();
      expect(firstStart).toBeGreaterThanOrEqual(before);
      expect(firstStart).toBeLessThanOrEqual(after);
    });

    it('should clean up all associated documents when deleting incomplete microcycles', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 2,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 3,
        calibratedExercises: exerciseCTOs.flatMap((c) =>
          c.bestCalibration ? [c.bestCalibration._id] : []
        )
      });

      // Generate initial plan
      const initialResult = WorkoutMesocycleService.generateOrUpdateMesocycle(
        mesocycle,
        exerciseCTOs
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
        exerciseCTOs,
        [],
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

    it('should populate volume landmark map when volumeCTOs are provided', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO(
        [{ startingSetCount: 3, peakSetCount: 7, avgRsm: 5, avgPerformanceScore: 2.5 }],
        workoutTestUtil.STANDARD_MUSCLE_GROUPS.chest._id
      );

      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: workoutTestUtil.userId,
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 1,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [],
        plannedMicrocycleCount: 3,
        calibratedExercises: exerciseCTOs.flatMap((c) =>
          c.bestCalibration ? [c.bestCalibration._id] : []
        )
      });

      const result = WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, exerciseCTOs, [
        volumeCTO
      ]);

      // Should generate normally (volume data doesn't change structure)
      expect(result.microcycles?.create).toHaveLength(3);
      expect(result.sessions?.create?.length).toBeGreaterThan(0);
      expect(result.sets?.create?.length).toBeGreaterThan(0);
    });

    describe('cycle-type-specific generation', () => {
      it('should skip deload for Resensitization cycles', () => {
        const exerciseCTOs = [
          workoutTestUtil.createExerciseCTO({
            exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
            equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
          })
        ];

        const mesocycle = WorkoutMesocycleSchema.parse({
          userId: workoutTestUtil.userId,
          cycleType: CycleType.Resensitization,
          plannedSessionCountPerMicrocycle: 1,
          plannedMicrocycleLengthInDays: 7,
          plannedMicrocycleRestDays: [],
          plannedMicrocycleCount: 4,
          calibratedExercises: exerciseCTOs.flatMap((c) =>
            c.bestCalibration ? [c.bestCalibration._id] : []
          )
        });

        const result = WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, exerciseCTOs);
        const sets = result.sets?.create ?? [];

        // All 4 microcycles should be accumulation (no deload)
        expect(result.microcycles?.create).toHaveLength(4);

        // No sets should have null plannedRir (which would indicate deload)
        const deloadSets = sets.filter((s) => s.plannedRir === null);
        expect(deloadSets).toHaveLength(0);
      });

      it('should start RIR at 3 for Cut cycles instead of 4', () => {
        const exerciseCTOs = [
          workoutTestUtil.createExerciseCTO({
            exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
            equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
          })
        ];

        const mesocycle = WorkoutMesocycleSchema.parse({
          userId: workoutTestUtil.userId,
          cycleType: CycleType.Cut,
          plannedSessionCountPerMicrocycle: 1,
          plannedMicrocycleLengthInDays: 7,
          plannedMicrocycleRestDays: [],
          plannedMicrocycleCount: 6,
          calibratedExercises: exerciseCTOs.flatMap((c) =>
            c.bestCalibration ? [c.bestCalibration._id] : []
          )
        });

        const result = WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, exerciseCTOs);
        const sets = result.sets?.create ?? [];
        const sessions = result.sessions?.create ?? [];
        const microcycles = result.microcycles?.create ?? [];

        // First microcycle's first session's sets should have RIR 3 (not 4)
        const firstMicrocycle = microcycles[0];
        const firstSession = sessions.find((s) => s.workoutMicrocycleId === firstMicrocycle._id);
        const firstMicrocycleSets = sets.filter((s) => s.workoutSessionId === firstSession?._id);
        expect(firstMicrocycleSets[0].plannedRir).toBe(3);
      });

      it('should keep RIR flat at 3 for all Resensitization microcycles', () => {
        const exerciseCTOs = [
          workoutTestUtil.createExerciseCTO({
            exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
            equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
          })
        ];

        const mesocycle = WorkoutMesocycleSchema.parse({
          userId: workoutTestUtil.userId,
          cycleType: CycleType.Resensitization,
          plannedSessionCountPerMicrocycle: 1,
          plannedMicrocycleLengthInDays: 7,
          plannedMicrocycleRestDays: [],
          plannedMicrocycleCount: 4,
          calibratedExercises: exerciseCTOs.flatMap((c) =>
            c.bestCalibration ? [c.bestCalibration._id] : []
          )
        });

        const result = WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, exerciseCTOs);
        const sets = result.sets?.create ?? [];
        const sessions = result.sessions?.create ?? [];
        const microcycles = result.microcycles?.create ?? [];

        // All microcycles should have RIR 3 (no taper)
        for (const mc of microcycles) {
          const mcSession = sessions.find((s) => s.workoutMicrocycleId === mc._id);
          const mcSets = sets.filter((s) => s.workoutSessionId === mcSession?._id);
          expect(mcSets.length).toBeGreaterThan(0);
          expect(mcSets[0].plannedRir).toBe(3);
        }
      });

      it('should preserve FreeForm early exit', () => {
        const exerciseCTOs = [
          workoutTestUtil.createExerciseCTO({
            exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
            equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
          })
        ];

        const mesocycle = WorkoutMesocycleSchema.parse({
          userId: workoutTestUtil.userId,
          cycleType: CycleType.FreeForm,
          plannedSessionCountPerMicrocycle: 1,
          plannedMicrocycleLengthInDays: 7,
          plannedMicrocycleRestDays: [],
          plannedMicrocycleCount: 3,
          calibratedExercises: exerciseCTOs.flatMap((c) =>
            c.bestCalibration ? [c.bestCalibration._id] : []
          )
        });

        const result = WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, exerciseCTOs);
        expect(result.microcycles).toBeUndefined();
        expect(result.sessions).toBeUndefined();
      });
    });

    describe('cross-mesocycle continuity', () => {
      /**
       * Helper to extract the first set of a given exercise from the first microcycle
       * of a mesocycle generation result.
       */
      function getFirstSetForExercise(
        result: ReturnType<typeof WorkoutMesocycleService.generateOrUpdateMesocycle>,
        exerciseId: UUID
      ): WorkoutSet | undefined {
        const sets = result.sets?.create ?? [];
        const microcycles = result.microcycles?.create ?? [];
        const sessions = result.sessions?.create ?? [];
        const sessionExercises = result.sessionExercises?.create ?? [];

        if (microcycles.length === 0) return undefined;

        const firstMicrocycleId = microcycles[0]._id;
        const firstMicrocycleSessions = sessions.filter(
          (s) => s.workoutMicrocycleId === firstMicrocycleId
        );
        const firstMicrocycleSessionIds = new Set(firstMicrocycleSessions.map((s) => s._id));

        const matchingSessionExercise = sessionExercises.find(
          (se) =>
            se.workoutExerciseId === exerciseId &&
            firstMicrocycleSessionIds.has(se.workoutSessionId)
        );
        if (!matchingSessionExercise) return undefined;

        const firstSetId = matchingSessionExercise.setOrder[0];
        return sets.find((s) => s._id === firstSetId);
      }

      it('should use previous performance data when exercise has lastFirstSet populated', () => {
        // Create a CTO with lastFirstSet simulating a previous mesocycle's actual performance
        const previousWeight = 225;
        const lastFirstSet = workoutTestUtil.createSet({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          overrides: {
            plannedReps: 15,
            plannedWeight: previousWeight,
            plannedRir: 1,
            actualReps: 15,
            actualWeight: previousWeight,
            rir: 1
          }
        });

        const lastSessionExercise = workoutTestUtil.createSessionExercise({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat
        });

        const exerciseCTOWithHistory = workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell,
          lastFirstSet,
          lastSessionExercise
        });

        const exerciseCTOs = [exerciseCTOWithHistory];

        const mesocycle = WorkoutMesocycleSchema.parse({
          userId: workoutTestUtil.userId,
          cycleType: CycleType.MuscleGain,
          plannedSessionCountPerMicrocycle: 1,
          plannedMicrocycleLengthInDays: 7,
          plannedMicrocycleRestDays: [],
          plannedMicrocycleCount: 3,
          calibratedExercises: exerciseCTOs.flatMap((c) =>
            c.bestCalibration ? [c.bestCalibration._id] : []
          )
        });

        const result = WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, exerciseCTOs);

        const firstSet = getFirstSetForExercise(
          result,
          workoutTestUtil.STANDARD_EXERCISES.barbellSquat._id
        );

        if (!firstSet) {
          throw new Error('Expected first set to be defined for history result');
        }

        // Also generate without history for comparison
        const exerciseCTOWithoutHistory = workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        });

        const resultNoHistory = WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, [
          exerciseCTOWithoutHistory
        ]);

        const firstSetNoHistory = getFirstSetForExercise(
          resultNoHistory,
          workoutTestUtil.STANDARD_EXERCISES.barbellSquat._id
        );

        if (!firstSet || !firstSetNoHistory) {
          throw new Error('Expected first sets to be defined for both results');
        }

        // The weight with history should differ from the calibration-only weight,
        // proving that autoregulation used the previous mesocycle's data.
        // Load progression with surplus 0: weight increases by 2% from 225
        expect(firstSet.plannedWeight).not.toBe(firstSetNoHistory.plannedWeight);
        expect(firstSet.plannedWeight).toBeGreaterThanOrEqual(previousWeight * 1.02);
      });

      it('should use calibration formula when exercise CTO has no prior performance data', () => {
        // CTO with calibration but no lastFirstSet or lastSessionExercise (new exercise)
        const exerciseCTONew = workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell,
          lastFirstSet: null,
          lastSessionExercise: null,
          bestSet: null
        });

        const exerciseCTOs = [exerciseCTONew];

        const mesocycle = WorkoutMesocycleSchema.parse({
          userId: workoutTestUtil.userId,
          cycleType: CycleType.MuscleGain,
          plannedSessionCountPerMicrocycle: 1,
          plannedMicrocycleLengthInDays: 7,
          plannedMicrocycleRestDays: [],
          plannedMicrocycleCount: 3,
          calibratedExercises: exerciseCTOs.flatMap((c) =>
            c.bestCalibration ? [c.bestCalibration._id] : []
          )
        });

        const result = WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, exerciseCTOs);

        const firstSet = getFirstSetForExercise(
          result,
          workoutTestUtil.STANDARD_EXERCISES.barbellSquat._id
        );

        if (!firstSet) {
          throw new Error('Expected first set to be defined');
        }

        expect(firstSet.plannedWeight).toBeGreaterThan(0);
        expect(firstSet.plannedReps).toBeGreaterThan(0);

        // Verify it matches the calibration-only path by generating independently
        // with an explicit calibration-based CTO
        const exerciseCTODefault = workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        });

        const resultDefault = WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, [
          exerciseCTODefault
        ]);

        const firstSetDefault = getFirstSetForExercise(
          resultDefault,
          workoutTestUtil.STANDARD_EXERCISES.barbellSquat._id
        );

        if (!firstSetDefault) {
          throw new Error('Expected default first set to be defined');
        }

        // Both should produce the same calibration-based weight
        expect(firstSet.plannedWeight).toBe(firstSetDefault.plannedWeight);
        expect(firstSet.plannedReps).toBe(firstSetDefault.plannedReps);
      });

      it('should throw when exercise CTO has no calibration data at all', () => {
        // CTO with no calibration, no prior sets, no prior performance
        const exerciseCTONoCal = workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
          calibration: null,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell,
          lastFirstSet: null,
          lastSessionExercise: null,
          bestSet: null
        });

        const exerciseCTOs = [exerciseCTONoCal];

        const mesocycle = WorkoutMesocycleSchema.parse({
          userId: workoutTestUtil.userId,
          cycleType: CycleType.MuscleGain,
          plannedSessionCountPerMicrocycle: 1,
          plannedMicrocycleLengthInDays: 7,
          plannedMicrocycleRestDays: [],
          plannedMicrocycleCount: 3,
          calibratedExercises: []
        });

        // Should throw because no calibration exists for the exercise
        expect(() => {
          WorkoutMesocycleService.generateOrUpdateMesocycle(mesocycle, exerciseCTOs);
        }).toThrow(/no bestCalibration/i);
      });
    });
  });

  describe('getProjectedEndDate', () => {
    it('should return the last microcycle endDate when microcycles exist', () => {
      const mesocycle = workoutTestUtil.createMesocycle({
        startDate: new Date('2026-01-01T00:00:00.000Z')
      });
      const micro1 = workoutTestUtil.createMicrocycle({
        mesocycle,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-01-08T00:00:00.000Z')
      });
      const micro2 = workoutTestUtil.createMicrocycle({
        mesocycle,
        startDate: new Date('2026-01-08T00:00:00.000Z'),
        endDate: new Date('2026-01-15T00:00:00.000Z')
      });

      const result = WorkoutMesocycleService.getProjectedEndDate(mesocycle, [micro1, micro2]);

      expect(result).not.toBeNull();
      expect(result?.getTime()).toBe(new Date('2026-01-15T00:00:00.000Z').getTime());
    });

    it('should calculate from start date and planned parameters when no microcycles exist', () => {
      const mesocycle = workoutTestUtil.createMesocycle({
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        plannedMicrocycleCount: 4,
        plannedMicrocycleLengthInDays: 7
      });

      const result = WorkoutMesocycleService.getProjectedEndDate(mesocycle, []);

      expect(result).not.toBeNull();
      // 4 microcycles * 7 days = 28 days
      expect(result?.getTime()).toBe(new Date('2026-01-29T00:00:00.000Z').getTime());
    });

    it('should return null when mesocycle has no start date and no microcycles', () => {
      const mesocycle = workoutTestUtil.createMesocycle();

      const result = WorkoutMesocycleService.getProjectedEndDate(mesocycle, []);

      expect(result).toBeNull();
    });
  });

  describe('shiftMesocycleDates', () => {
    it('should shift all dates forward by the specified number of days in place', () => {
      const mesocycle = workoutTestUtil.createMesocycle({
        startDate: new Date('2026-01-01T00:00:00.000Z')
      });
      const micro = workoutTestUtil.createMicrocycle({
        mesocycle,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-01-08T00:00:00.000Z')
      });
      const session = workoutTestUtil.createSession({
        microcycle: micro,
        startTime: new Date('2026-01-02T00:00:00.000Z')
      });

      WorkoutMesocycleService.shiftMesocycleDates(mesocycle, [micro], [session], 7);

      expect(mesocycle.startDate?.getTime()).toBe(new Date('2026-01-08T00:00:00.000Z').getTime());
      expect(micro.startDate.getTime()).toBe(new Date('2026-01-08T00:00:00.000Z').getTime());
      expect(micro.endDate.getTime()).toBe(new Date('2026-01-15T00:00:00.000Z').getTime());
      expect(session.startTime.getTime()).toBe(new Date('2026-01-09T00:00:00.000Z').getTime());
    });

    it('should shift dates backward with negative days', () => {
      const mesocycle = workoutTestUtil.createMesocycle({
        startDate: new Date('2026-01-15T00:00:00.000Z')
      });
      const micro = workoutTestUtil.createMicrocycle({
        mesocycle,
        startDate: new Date('2026-01-15T00:00:00.000Z'),
        endDate: new Date('2026-01-22T00:00:00.000Z')
      });

      WorkoutMesocycleService.shiftMesocycleDates(mesocycle, [micro], [], -3);

      expect(mesocycle.startDate?.getTime()).toBe(new Date('2026-01-12T00:00:00.000Z').getTime());
      expect(micro.startDate.getTime()).toBe(new Date('2026-01-12T00:00:00.000Z').getTime());
    });

    it('should not modify startDate if mesocycle has no startDate', () => {
      const mesocycle = workoutTestUtil.createMesocycle();
      const micro = workoutTestUtil.createMicrocycle({
        mesocycle,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-01-08T00:00:00.000Z')
      });

      WorkoutMesocycleService.shiftMesocycleDates(mesocycle, [micro], [], 5);

      expect(mesocycle.startDate).toBeUndefined();
    });
  });

  describe('getProjectedStartDate', () => {
    it('should return mesocycle startDate when set', () => {
      const startDate = new Date('2026-01-01T00:00:00.000Z');
      const mesocycle = workoutTestUtil.createMesocycle({ startDate });

      const result = WorkoutMesocycleService.getProjectedStartDate(mesocycle, []);

      expect(result?.getTime()).toBe(startDate.getTime());
    });

    it('should fall back to earliest microcycle start date when mesocycle has no startDate', () => {
      const mesocycle = workoutTestUtil.createMesocycle();
      const micro1 = workoutTestUtil.createMicrocycle({
        mesocycle,
        startDate: new Date('2026-01-08T00:00:00.000Z'),
        endDate: new Date('2026-01-15T00:00:00.000Z')
      });
      const micro2 = workoutTestUtil.createMicrocycle({
        mesocycle,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-01-08T00:00:00.000Z')
      });

      const result = WorkoutMesocycleService.getProjectedStartDate(mesocycle, [micro1, micro2]);

      expect(result?.getTime()).toBe(new Date('2026-01-01T00:00:00.000Z').getTime());
    });

    it('should return null when no startDate and no microcycles', () => {
      const mesocycle = workoutTestUtil.createMesocycle();

      const result = WorkoutMesocycleService.getProjectedStartDate(mesocycle, []);

      expect(result).toBeNull();
    });
  });

  describe('detectMesocycleOverlap', () => {
    it('should detect overlapping mesocycles', () => {
      const meso1 = workoutTestUtil.createMesocycle({
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        plannedMicrocycleCount: 3,
        plannedMicrocycleLengthInDays: 7
      });
      const meso2 = workoutTestUtil.createMesocycle({
        startDate: new Date('2026-01-15T00:00:00.000Z'),
        plannedMicrocycleCount: 3,
        plannedMicrocycleLengthInDays: 7
      });

      const mesoToMicros = new Map<UUID, WorkoutMicrocycle[]>([
        [meso1._id, []],
        [meso2._id, []]
      ]);

      // meso1 ends at Jan 22, meso2 starts at Jan 15 -> overlap
      const result = WorkoutMesocycleService.detectMesocycleOverlap([meso1, meso2], mesoToMicros);

      expect(result.hasOverlap).toBe(true);
      expect(result.overlappingPairs).toHaveLength(1);
    });

    it('should detect overlap with a future mesocycle that has no startDate', () => {
      const meso1 = workoutTestUtil.createMesocycle({
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        plannedMicrocycleCount: 4,
        plannedMicrocycleLengthInDays: 7
      });
      // Future mesocycle: no startDate, but has microcycles with dates
      const meso2 = workoutTestUtil.createMesocycle({
        plannedMicrocycleCount: 3,
        plannedMicrocycleLengthInDays: 7
      });
      const futureMicro = workoutTestUtil.createMicrocycle({
        mesocycle: meso2,
        startDate: new Date('2026-01-15T00:00:00.000Z'),
        endDate: new Date('2026-02-05T00:00:00.000Z')
      });

      const mesoToMicros = new Map<UUID, WorkoutMicrocycle[]>([
        [meso1._id, []],
        [meso2._id, [futureMicro]]
      ]);

      // meso1 ends at Jan 29 (4×7), meso2 starts at Jan 15 via microcycle -> overlap
      const result = WorkoutMesocycleService.detectMesocycleOverlap([meso1, meso2], mesoToMicros);

      expect(result.hasOverlap).toBe(true);
      expect(result.overlappingPairs).toHaveLength(1);
    });

    it('should not detect overlap for non-overlapping mesocycles', () => {
      const meso1 = workoutTestUtil.createMesocycle({
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        plannedMicrocycleCount: 2,
        plannedMicrocycleLengthInDays: 7
      });
      const meso2 = workoutTestUtil.createMesocycle({
        startDate: new Date('2026-01-15T00:00:00.000Z'),
        plannedMicrocycleCount: 2,
        plannedMicrocycleLengthInDays: 7
      });

      const mesoToMicros = new Map<UUID, WorkoutMicrocycle[]>([
        [meso1._id, []],
        [meso2._id, []]
      ]);

      // meso1 ends at Jan 15, meso2 starts at Jan 15 -> no overlap (end is exclusive)
      const result = WorkoutMesocycleService.detectMesocycleOverlap([meso1, meso2], mesoToMicros);

      expect(result.hasOverlap).toBe(false);
    });
  });

  describe('getEarliestAllowedStartDate', () => {
    it('should return approximately today when no existing mesocycles', () => {
      const before = new Date();
      const result = WorkoutMesocycleService.getEarliestAllowedStartDate([], new Map());
      const after = new Date();

      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should return projected end of latest uncompleted mesocycle when it is in the future', () => {
      const now = new Date();
      const mesocycle = workoutTestUtil.createMesocycle({
        startDate: now,
        plannedMicrocycleCount: 4,
        plannedMicrocycleLengthInDays: 7
      });

      const mesoToMicros = new Map<UUID, WorkoutMicrocycle[]>([[mesocycle._id, []]]);

      // Projected end is now + 28 days (via getProjectedEndDate)
      const expectedEnd = WorkoutMesocycleService.getProjectedEndDate(mesocycle, []);

      const result = WorkoutMesocycleService.getEarliestAllowedStartDate([mesocycle], mesoToMicros);

      expect(result.getTime()).toBe(expectedEnd?.getTime());
    });

    it('should skip completed mesocycles', () => {
      const before = new Date();
      const completedMesocycle = workoutTestUtil.createMesocycle({
        startDate: new Date('2025-01-01T00:00:00.000Z'),
        plannedMicrocycleCount: 4,
        plannedMicrocycleLengthInDays: 7,
        completedDate: new Date('2025-01-28T00:00:00.000Z')
      });

      const mesoToMicros = new Map<UUID, WorkoutMicrocycle[]>([[completedMesocycle._id, []]]);

      const result = WorkoutMesocycleService.getEarliestAllowedStartDate(
        [completedMesocycle],
        mesoToMicros
      );
      const after = new Date();

      // Should return approximately today since the only mesocycle is completed
      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should return today when projected end is in the past', () => {
      const before = new Date();
      const mesocycle = workoutTestUtil.createMesocycle({
        startDate: new Date('2025-01-01T00:00:00.000Z'),
        plannedMicrocycleCount: 4,
        plannedMicrocycleLengthInDays: 7
      });

      const mesoToMicros = new Map<UUID, WorkoutMicrocycle[]>([[mesocycle._id, []]]);

      // Projected end is Jan 29 2025, which is in the past
      const result = WorkoutMesocycleService.getEarliestAllowedStartDate([mesocycle], mesoToMicros);
      const after = new Date();

      // Should return approximately today since projected end is in the past
      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('shouldTriggerEarlyDeload', () => {
    const { barbellSquat, barbellBenchPress, dumbbellLateralRaise, cableRow, cableTricepPushdown } =
      workoutTestUtil.STANDARD_EXERCISES;
    const { hamstrings } = workoutTestUtil.STANDARD_MUSCLE_GROUPS;

    // Custom hamstring exercise + calibration for 6-group coverage
    const hamstringExercise = workoutTestUtil.createExercise({
      primaryMuscleGroups: [hamstrings._id]
    });
    const hamstringCalibration = workoutTestUtil.createCalibration({
      exercise: hamstringExercise
    });

    // CTOs covering 6 distinct muscle groups
    const sixGroupCTOs = [
      workoutTestUtil.createExerciseCTO({
        exercise: barbellSquat,
        calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat,
        equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
      }),
      workoutTestUtil.createExerciseCTO({
        exercise: barbellBenchPress,
        calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
        equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
      }),
      workoutTestUtil.createExerciseCTO({
        exercise: dumbbellLateralRaise,
        calibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise,
        equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell
      }),
      workoutTestUtil.createExerciseCTO({
        exercise: cableRow,
        calibration: workoutTestUtil.STANDARD_CALIBRATIONS.cableRow,
        equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.cable
      }),
      workoutTestUtil.createExerciseCTO({
        exercise: hamstringExercise,
        calibration: hamstringCalibration,
        equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
      }),
      workoutTestUtil.createExerciseCTO({
        exercise: cableTricepPushdown,
        calibration: workoutTestUtil.STANDARD_CALIBRATIONS.cableTricepPushdown,
        equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.cable
      })
    ];

    // CTOs covering 5 distinct muscle groups (no triceps)
    const fiveGroupCTOs = sixGroupCTOs.slice(0, 5);

    // Shared mesocycle and 3 microcycles (so index 2 passes the guard)
    const mesocycle = workoutTestUtil.createMesocycle();
    const mc1 = workoutTestUtil.createMicrocycle({
      mesocycle,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-08')
    });
    const mc2 = workoutTestUtil.createMicrocycle({
      mesocycle,
      startDate: new Date('2024-01-08'),
      endDate: new Date('2024-01-15')
    });
    const mc3 = workoutTestUtil.createMicrocycle({
      mesocycle,
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-01-22')
    });
    // A 4th microcycle ensures mc3 is NOT the last (deload) microcycle,
    // which would cause the deload guard to suppress recommendations.
    const mc4 = workoutTestUtil.createMicrocycle({
      mesocycle,
      startDate: new Date('2024-01-22'),
      endDate: new Date('2024-01-29')
    });
    const allMicrocycles = [mc1, mc2, mc3, mc4];

    // Session in the current (3rd) microcycle for linking session exercises
    const recentSession = workoutTestUtil.createSession({ microcycle: mc3 });
    const allSessions = [recentSession];

    /**
     * Creates a session exercise linked to the recent session.
     */
    const createSE = (
      exercise: { _id: UUID },
      setIds: UUID[],
      isRecovery = false
    ): WorkoutSessionExercise => {
      return workoutTestUtil.createSessionExercise({
        session: recentSession,
        overrides: {
          workoutExerciseId: exercise._id,
          isRecoveryExercise: isRecovery,
          setOrder: setIds
        }
      });
    };

    /**
     * Creates a set with planned and actual data for performance drop testing.
     */
    const createSetWithData = (
      plannedReps: number,
      actualReps: number,
      plannedRir: number,
      actualRir: number
    ): WorkoutSet => {
      return workoutTestUtil.createSet({
        overrides: {
          plannedReps,
          actualReps,
          plannedRir,
          rir: actualRir
        }
      });
    };

    /**
     * Calls shouldTriggerEarlyDeload with the shared test fixtures.
     */
    const evaluate = (
      sessionExercises: WorkoutSessionExercise[],
      sets: WorkoutSet[],
      options?: {
        exerciseCTOs?: typeof sixGroupCTOs;
        currentMicrocycleId?: UUID;
      }
    ) => {
      return WorkoutMesocycleService.shouldTriggerEarlyDeload(
        mesocycle,
        options?.exerciseCTOs ?? sixGroupCTOs,
        options?.currentMicrocycleId ?? mc3._id,
        allMicrocycles,
        allSessions,
        sessionExercises,
        sets
      );
    };

    describe('microcycle guard', () => {
      it('should return no trigger before microcycle index 2', () => {
        const result = evaluate([], [], { currentMicrocycleId: mc2._id });

        expect(result.shouldDeload).toBe(false);
        expect(result.severity).toBe(WorkoutDeloadSeverity.None);
        expect(result.triggeredRules).toHaveLength(0);
      });

      it('should evaluate rules at microcycle index 2', () => {
        // No recovery exercises, no performance drops — should still return no trigger
        const result = evaluate([], []);

        expect(result.shouldDeload).toBe(false);
        expect(result.severity).toBe(WorkoutDeloadSeverity.None);
      });
    });

    describe('recovery session threshold', () => {
      it('should not trigger when 0 of 6 muscle groups had recovery', () => {
        const se1 = createSE(barbellSquat, []);
        const se2 = createSE(barbellBenchPress, []);

        const result = evaluate([se1, se2], []);

        expect(result.shouldDeload).toBe(false);
      });

      it('should not trigger when 2 of 6 muscle groups had recovery (33%)', () => {
        const se1 = createSE(barbellSquat, [], true); // quads
        const se2 = createSE(barbellBenchPress, [], true); // chest

        const result = evaluate([se1, se2], []);

        expect(result.shouldDeload).toBe(false);
      });

      it('should return Suggested when 2 of 5 muscle groups had recovery (40%)', () => {
        const se1 = createSE(barbellSquat, [], true); // quads
        const se2 = createSE(barbellBenchPress, [], true); // chest

        const result = evaluate([se1, se2], [], { exerciseCTOs: fiveGroupCTOs });

        expect(result.shouldDeload).toBe(true);
        expect(result.severity).toBe(WorkoutDeloadSeverity.Suggested);
        expect(result.triggeredRules).toContain(WorkoutDeloadTriggerRule.RecoverySessionThreshold);
      });

      it('should return Suggested when 3 of 6 muscle groups had recovery (50%)', () => {
        const se1 = createSE(barbellSquat, [], true); // quads
        const se2 = createSE(barbellBenchPress, [], true); // chest
        const se3 = createSE(dumbbellLateralRaise, [], true); // shoulders

        const result = evaluate([se1, se2, se3], []);

        expect(result.shouldDeload).toBe(true);
        expect(result.severity).toBe(WorkoutDeloadSeverity.Suggested);
      });

      it('should return Recommended when 4 of 6 muscle groups had recovery (67%)', () => {
        const se1 = createSE(barbellSquat, [], true); // quads
        const se2 = createSE(barbellBenchPress, [], true); // chest
        const se3 = createSE(dumbbellLateralRaise, [], true); // shoulders
        const se4 = createSE(cableRow, [], true); // back

        const result = evaluate([se1, se2, se3, se4], []);

        expect(result.shouldDeload).toBe(true);
        expect(result.severity).toBe(WorkoutDeloadSeverity.Recommended);
      });

      it('should return Recommended when 6 of 6 muscle groups had recovery (100%)', () => {
        const se1 = createSE(barbellSquat, [], true); // quads
        const se2 = createSE(barbellBenchPress, [], true); // chest
        const se3 = createSE(dumbbellLateralRaise, [], true); // shoulders
        const se4 = createSE(cableRow, [], true); // back
        const se5 = createSE(hamstringExercise, [], true); // hamstrings
        const se6 = createSE(cableTricepPushdown, [], true); // triceps

        const result = evaluate([se1, se2, se3, se4, se5, se6], []);

        expect(result.shouldDeload).toBe(true);
        expect(result.severity).toBe(WorkoutDeloadSeverity.Recommended);
      });

      it('should count each muscle group only once even with multiple recovery exercises', () => {
        // Two exercises targeting the same muscle group (quads)
        const se1 = createSE(barbellSquat, [], true); // quads
        const se2 = createSE(barbellSquat, [], true); // quads again

        const result = evaluate([se1, se2], []);

        // Only 1 of 6 muscle groups (quads) had recovery = 17%, no trigger
        expect(result.shouldDeload).toBe(false);
      });
    });

    describe('consecutive performance drops', () => {
      it('should not trigger with only 1 session below by 3 reps', () => {
        const set1 = createSetWithData(15, 12, 2, 2);
        const se1 = createSE(barbellSquat, [set1._id]);

        const result = evaluate([se1], [set1]);

        expect(result.shouldDeload).toBe(false);
      });

      it('should trigger with 2 consecutive sessions below by 3 reps', () => {
        const set1 = createSetWithData(15, 12, 2, 2);
        const set2 = createSetWithData(15, 11, 2, 2);
        const se1 = createSE(barbellSquat, [set1._id]);
        const se2 = createSE(barbellSquat, [set2._id]);

        const result = evaluate([se1, se2], [set1, set2]);

        expect(result.shouldDeload).toBe(true);
        expect(result.triggeredRules).toContain(
          WorkoutDeloadTriggerRule.ConsecutivePerformanceDrop
        );
        expect(result.severity).toBe(WorkoutDeloadSeverity.Suggested);
      });

      it('should not trigger with 2 non-consecutive sessions below by 3 reps', () => {
        const set1 = createSetWithData(15, 12, 2, 2); // deficit 3
        const set2 = createSetWithData(15, 15, 2, 2); // on target (resets counter)
        const set3 = createSetWithData(15, 12, 2, 2); // deficit 3 again
        const se1 = createSE(barbellSquat, [set1._id]);
        const se2 = createSE(barbellSquat, [set2._id]);
        const se3 = createSE(barbellSquat, [set3._id]);

        const result = evaluate([se1, se2, se3], [set1, set2, set3]);

        expect(result.shouldDeload).toBe(false);
      });

      it('should trigger when surplus is exactly -3', () => {
        // plannedReps=15, actualReps=12, same RIR -> surplus = -3
        const set1 = createSetWithData(15, 12, 2, 2);
        const set2 = createSetWithData(15, 12, 2, 2);
        const se1 = createSE(barbellSquat, [set1._id]);
        const se2 = createSE(barbellSquat, [set2._id]);

        const result = evaluate([se1, se2], [set1, set2]);

        expect(result.shouldDeload).toBe(true);
      });

      it('should not trigger when deficit is only 2 reps', () => {
        const set1 = createSetWithData(15, 13, 2, 2); // surplus = -2
        const set2 = createSetWithData(15, 13, 2, 2); // surplus = -2
        const se1 = createSE(barbellSquat, [set1._id]);
        const se2 = createSE(barbellSquat, [set2._id]);

        const result = evaluate([se1, se2], [set1, set2]);

        expect(result.shouldDeload).toBe(false);
      });

      it('should return Recommended when 2+ exercises have consecutive drops', () => {
        // Exercise 1: barbell squat with 2 consecutive drops
        const setA1 = createSetWithData(15, 12, 2, 2);
        const setA2 = createSetWithData(15, 11, 2, 2);
        const seA1 = createSE(barbellSquat, [setA1._id]);
        const seA2 = createSE(barbellSquat, [setA2._id]);

        // Exercise 2: bench press with 2 consecutive drops
        const setB1 = createSetWithData(10, 7, 2, 2);
        const setB2 = createSetWithData(10, 6, 2, 2);
        const seB1 = createSE(barbellBenchPress, [setB1._id]);
        const seB2 = createSE(barbellBenchPress, [setB2._id]);

        const result = evaluate([seA1, seA2, seB1, seB2], [setA1, setA2, setB1, setB2]);

        expect(result.shouldDeload).toBe(true);
        expect(result.severity).toBe(WorkoutDeloadSeverity.Recommended);
      });

      it('should reset consecutive counter when set data is incomplete', () => {
        const set1 = createSetWithData(15, 12, 2, 2); // surplus = -3
        const setIncomplete = workoutTestUtil.createSet({
          overrides: { plannedReps: 15, actualReps: null, plannedRir: 2, rir: null }
        });
        const set3 = createSetWithData(15, 12, 2, 2); // surplus = -3
        const se1 = createSE(barbellSquat, [set1._id]);
        const se2 = createSE(barbellSquat, [setIncomplete._id]);
        const se3 = createSE(barbellSquat, [set3._id]);

        const result = evaluate([se1, se2, se3], [set1, setIncomplete, set3]);

        // Incomplete set resets counter, so drops are not consecutive
        expect(result.shouldDeload).toBe(false);
      });
    });

    describe('combined rules', () => {
      it('should return Urgent when both rules are triggered', () => {
        // Recovery: 4 of 6 muscle groups (Recommended)
        const recovSE1 = createSE(barbellSquat, [], true); // quads
        const recovSE2 = createSE(barbellBenchPress, [], true); // chest
        const recovSE3 = createSE(dumbbellLateralRaise, [], true); // shoulders
        const recovSE4 = createSE(cableRow, [], true); // back

        // Performance: 2 consecutive drops for barbell squat
        const set1 = createSetWithData(15, 12, 2, 2);
        const set2 = createSetWithData(15, 11, 2, 2);
        const perfSE1 = createSE(barbellSquat, [set1._id]);
        const perfSE2 = createSE(barbellSquat, [set2._id]);

        const result = evaluate(
          [recovSE1, recovSE2, recovSE3, recovSE4, perfSE1, perfSE2],
          [set1, set2]
        );

        expect(result.shouldDeload).toBe(true);
        expect(result.severity).toBe(WorkoutDeloadSeverity.Urgent);
        expect(result.triggeredRules).toHaveLength(2);
        expect(result.triggeredRules).toContain(WorkoutDeloadTriggerRule.RecoverySessionThreshold);
        expect(result.triggeredRules).toContain(
          WorkoutDeloadTriggerRule.ConsecutivePerformanceDrop
        );
      });

      it('should return no trigger when neither rule is met', () => {
        const se1 = createSE(barbellSquat, []);
        const se2 = createSE(barbellBenchPress, []);

        const result = evaluate([se1, se2], []);

        expect(result.shouldDeload).toBe(false);
        expect(result.severity).toBe(WorkoutDeloadSeverity.None);
        expect(result.triggeredRules).toHaveLength(0);
      });
    });
  });
});
