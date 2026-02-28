import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import WorkoutMicrocycleService from './WorkoutMicrocycleService.js';

describe('WorkoutMicrocycleService', () => {
  describe('generateSessionsForMicrocycle', () => {
    // Setup
    const exerciseCTOs = [
      // Group A: High Fatigue (e.g. Deadlift ~9)
      workoutTestUtil.createExerciseCTO({
        exercise: workoutTestUtil.STANDARD_EXERCISES.deadlift,
        calibration: workoutTestUtil.STANDARD_CALIBRATIONS.deadlift,
        equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
      }),
      // Group B: Medium Fatigue (e.g. Bench ~6)
      workoutTestUtil.createExerciseCTO({
        exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
        calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
        equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
      }),
      // Group C: Low Fatigue (e.g. Curls ~2)
      workoutTestUtil.createExerciseCTO({
        exercise: workoutTestUtil.STANDARD_EXERCISES.dumbbellCurl,
        calibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellCurl,
        equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell
      })
    ];

    const calibrationIds = exerciseCTOs
      .map((cto) => cto.bestCalibration?._id)
      .filter((id): id is NonNullable<typeof id> => id != null);

    const mesocycle = workoutTestUtil.createMesocycle({
      plannedSessionCountPerMicrocycle: 3,
      plannedMicrocycleRestDays: [1], // Skip day 1 (index 1 = Tuesday if Monday start)
      calibratedExercises: calibrationIds
    });

    // Need `microcyclesToCreate` pre-populated in context because the service looks it up.
    const microcycle = workoutTestUtil.createMicrocycle({
      mesocycle,
      startDate: new Date(2024, 0, 1), // Monday Jan 1st - Local Time
      endDate: new Date(2024, 0, 7)
    });

    const runGeneration = () => {
      const context = workoutTestUtil.createContext({
        mesocycle,
        exerciseCTOs
      });
      context.addMicrocycle(microcycle);

      context.setPlannedSessionExerciseCTOs(
        WorkoutMicrocycleService.distributeExercisesAcrossSessions(
          mesocycle.plannedSessionCountPerMicrocycle,
          exerciseCTOs
        )
      );

      WorkoutMicrocycleService.generateSessionsForMicrocycle({
        context,
        microcycleIndex: 0,
        targetRir: 3,
        isDeloadMicrocycle: false
      });

      return {
        sessions: context.sessionsToCreate,
        sessionExercises: context.sessionExercisesToCreate
      };
    };

    it('should sort exercises such that high fatigue groups headline sessions', () => {
      // We have 3 groups (Back/Quads(Deadlift), Chest(Bench), Biceps(Curl)).
      // Deadlift is hardest -> Priority 1. Should headline Session 1.
      // Bench is medium -> Priority 2. Should headline Session 2.
      // Curl is easy. Should fill in.

      const { sessions, sessionExercises } = runGeneration();

      expect(sessions).toHaveLength(3);

      // Verify Deadlift is in Session 1 (Highest Fatigue)
      const s1ExerciseIds = sessionExercises
        .filter((se) => se.workoutSessionId === sessions[0]._id)
        .map((se) => se.workoutExerciseId);
      expect(s1ExerciseIds).toContain(workoutTestUtil.STANDARD_EXERCISES.deadlift._id);

      // Verify Bench is in Session 2 (Next Highest)
      const s2ExIds = sessionExercises
        .filter((se) => se.workoutSessionId === sessions[1]._id)
        .map((se) => se.workoutExerciseId);
      expect(s2ExIds).toContain(workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id);
    });

    it('should create more sessions than non-rest days by cycling through dates', () => {
      // 7-day microcycle with rest days [0, 6] = 5 non-rest days (days 1-5)
      // But we want 6 sessions, so the 6th session should wrap to the first non-rest day
      const meso = workoutTestUtil.createMesocycle({
        plannedSessionCountPerMicrocycle: 6,
        plannedMicrocycleRestDays: [0, 6],
        calibratedExercises: calibrationIds
      });

      const micro = workoutTestUtil.createMicrocycle({
        mesocycle: meso,
        startDate: new Date(2024, 0, 1), // Monday Jan 1st
        endDate: new Date(2024, 0, 7)
      });

      const ctx = workoutTestUtil.createContext({
        mesocycle: meso,
        exerciseCTOs
      });
      ctx.addMicrocycle(micro);

      ctx.setPlannedSessionExerciseCTOs(
        WorkoutMicrocycleService.distributeExercisesAcrossSessions(
          meso.plannedSessionCountPerMicrocycle,
          exerciseCTOs
        )
      );

      WorkoutMicrocycleService.generateSessionsForMicrocycle({
        context: ctx,
        microcycleIndex: 0,
        targetRir: 3,
        isDeloadMicrocycle: false
      });

      // All 6 sessions should be created
      expect(ctx.sessionsToCreate).toHaveLength(6);

      // Non-rest days are indices 1-5: Jan 2, 3, 4, 5, 6
      // 6 sessions across 5 days = first day gets 2 sessions, rest get 1
      // Sessions are ordered chronologically: indices 0,1 on day 1, then 2,3,4,5
      const dates = ctx.sessionsToCreate.map((s) => new Date(s.startTime).getDate());
      expect(dates[0]).toBe(2); // Session 0: Day 1 (first non-rest day)
      expect(dates[1]).toBe(2); // Session 1: Day 1 (second session on same day)
      expect(dates[2]).toBe(3); // Session 2: Day 2
      expect(dates[3]).toBe(4); // Session 3: Day 3
      expect(dates[4]).toBe(5); // Session 4: Day 4
      expect(dates[5]).toBe(6); // Session 5: Day 5
    });

    it('should assign dates correctly, skipping rest days', () => {
      // Start: Jan 1 (Mon). Rest Days: [1] (Tue).
      // Session 1: Jan 1.
      // Session 2: Jan 3 (Wed). Skipped Jan 2.
      // Session 3: Jan 4 (Thu).

      const { sessions } = runGeneration();

      const s1Date = new Date(sessions[0].startTime);
      const s2Date = new Date(sessions[1].startTime);
      const s3Date = new Date(sessions[2].startTime);

      expect(s1Date.getDate()).toBe(1);
      expect(s2Date.getDate()).toBe(3); // Skipped 2
      expect(s3Date.getDate()).toBe(4);
    });
  });
});
