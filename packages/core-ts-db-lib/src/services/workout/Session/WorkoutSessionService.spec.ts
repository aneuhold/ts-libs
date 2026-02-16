import type { UUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import type { WorkoutExercise } from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutSessionExercise } from '../../../documents/workout/WorkoutSessionExercise.js';
import type { WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import WorkoutVolumePlanningService from '../util/VolumePlanning/WorkoutVolumePlanningService.js';
import WorkoutSessionService from './WorkoutSessionService.js';

describe('WorkoutSessionService', () => {
  describe('getActiveAndNextSessions', () => {
    const emptySeMap = new Map<UUID, WorkoutSessionExercise>();
    const emptySetMap = new Map<UUID, WorkoutSet>();

    it('should return both null when all sessions are complete', () => {
      const s1 = workoutTestUtil.createSession({ overrides: { complete: true } });
      const s2 = workoutTestUtil.createSession({ overrides: { complete: true } });

      const result = WorkoutSessionService.getActiveAndNextSessions(
        [s1, s2],
        emptySeMap,
        emptySetMap
      );
      expect(result.inProgressSession).toBeNull();
      expect(result.nextUpSession).toBeNull();
    });

    it('should return both null when there are no sessions', () => {
      const result = WorkoutSessionService.getActiveAndNextSessions([], emptySeMap, emptySetMap);
      expect(result.inProgressSession).toBeNull();
      expect(result.nextUpSession).toBeNull();
    });

    it('should return in-progress session when it has logged sets', () => {
      const s1 = workoutTestUtil.createSession({ overrides: { complete: true } });
      const s2 = workoutTestUtil.createSession({ overrides: { complete: false } });
      const s3 = workoutTestUtil.createSession({ overrides: { complete: false } });

      const se2 = workoutTestUtil.createSessionExercise({ session: s2 });
      const loggedSet = workoutTestUtil.createSet({
        session: s2,
        sessionExercise: se2,
        overrides: { actualReps: 10 }
      });
      se2.setOrder = [loggedSet._id];
      s2.sessionExerciseOrder = [se2._id];

      const seMap = new Map<UUID, WorkoutSessionExercise>([[se2._id, se2]]);
      const setMap = new Map<UUID, WorkoutSet>([[loggedSet._id, loggedSet]]);

      const result = WorkoutSessionService.getActiveAndNextSessions([s1, s2, s3], seMap, setMap);
      expect(result.inProgressSession?._id).toBe(s2._id);
      expect(result.nextUpSession?._id).toBe(s3._id);
    });

    it('should return nextUp when no in-progress session exists', () => {
      const s1 = workoutTestUtil.createSession({ overrides: { complete: true } });
      const s2 = workoutTestUtil.createSession({ overrides: { complete: false } });

      const result = WorkoutSessionService.getActiveAndNextSessions(
        [s1, s2],
        emptySeMap,
        emptySetMap
      );
      expect(result.inProgressSession).toBeNull();
      expect(result.nextUpSession?._id).toBe(s2._id);
    });

    it('should return only inProgress when all remaining incomplete sessions have logged sets', () => {
      const s1 = workoutTestUtil.createSession({ overrides: { complete: false } });

      const se1 = workoutTestUtil.createSessionExercise({ session: s1 });
      const loggedSet = workoutTestUtil.createSet({
        session: s1,
        sessionExercise: se1,
        overrides: { actualReps: 8 }
      });
      se1.setOrder = [loggedSet._id];
      s1.sessionExerciseOrder = [se1._id];

      const seMap = new Map<UUID, WorkoutSessionExercise>([[se1._id, se1]]);
      const setMap = new Map<UUID, WorkoutSet>([[loggedSet._id, loggedSet]]);

      const result = WorkoutSessionService.getActiveAndNextSessions([s1], seMap, setMap);
      expect(result.inProgressSession?._id).toBe(s1._id);
      expect(result.nextUpSession).toBeNull();
    });
  });

  const mesocycle = workoutTestUtil.createMesocycle({
    plannedSessionCountPerMicrocycle: 4,
    calibratedExercises: [
      workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat._id,
      workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress._id,
      workoutTestUtil.STANDARD_CALIBRATIONS.cableRow._id,
      workoutTestUtil.STANDARD_CALIBRATIONS.deadlift._id
    ]
  });

  const exercises: WorkoutExercise[] = [
    workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
    workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
    workoutTestUtil.STANDARD_EXERCISES.cableRow
  ];

  // Helper to generate a session and inspect set counts
  const getSetsPerExercise = (
    microcycleIndex: number,
    isDeload: boolean = false,
    inputExercises: WorkoutExercise[] = exercises
  ) => {
    const context = workoutTestUtil.createContext({
      mesocycle,
      calibrations: [workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat],
      exercises: inputExercises
    });

    // Populate dummy microcycles so that when generateSession looks for context.microcyclesToCreate[index], it exists.
    // We need to fill up to microcycleIndex.
    for (let i = 0; i <= microcycleIndex; i++) {
      context.addMicrocycle(
        workoutTestUtil.createMicrocycle({
          mesocycle,
          startDate: new Date(),
          endDate: new Date()
        })
      );
    }

    const localExerciseList = inputExercises.map((ex) => ({
      exercise: ex,
      calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat
    }));

    // This test calls generateSession directly, so we need to initialize the muscle-group-wide
    // ordering that microcycle generation would normally provide.
    context.setPlannedSessionExercisePairs([localExerciseList]);

    const setPlan = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(
      context,
      microcycleIndex,
      isDeload
    );

    WorkoutSessionService.generateSession({
      context,
      microcycleIndex,
      sessionIndex: 0,
      sessionStartDate: new Date(),
      sessionExerciseList: localExerciseList,
      targetRir: 2,
      isDeloadMicrocycle: isDeload,
      setPlan
    });

    // Count sets generated per exercise
    // result is in `context.setsToCreate`
    // We map them back to which exercise they belong to.
    const setsGeneratedPerExercise: Record<string, { exerciseName: string; count: number }> = {};
    let totalSets = 0;

    localExerciseList.forEach((pair) => {
      const count = context.setsToCreate.filter(
        (s) => s.workoutExerciseId === pair.exercise._id
      ).length;

      setsGeneratedPerExercise[pair.exercise._id] = {
        // Exercise name is added so it is easy to debug the tests and make out what you are
        // looking at.
        exerciseName: pair.exercise.exerciseName,
        count
      };
      totalSets += count;
    });

    return { setsGeneratedPerExercise, totalSets };
  };

  describe('Volume Progression', () => {
    it('should increase total set volume per muscle group with microcycle index', () => {
      // New rule: +1 total set per microcycle per muscle group.
      // With 3 different primary muscle groups in the session, total added sets is +3 per microcycle.

      const m0 = getSetsPerExercise(0);
      expect(m0.totalSets).toBe(6); // 3 groups * 2 sets

      const m1 = getSetsPerExercise(1);
      expect(m1.totalSets).toBe(9); // 3 groups * (2 + 1)

      const m2 = getSetsPerExercise(2);
      expect(m2.totalSets).toBe(12); // 3 groups * (2 + 2)
    });

    it('should distribute extra sets to earlier exercises within a muscle group', () => {
      const chestExercises: WorkoutExercise[] = [
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
        workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress
      ];

      // Micro 1: total sets for chest group = (2 * 2) + 1 = 5.
      // Distribution: first gets 3, second gets 2.
      const { setsGeneratedPerExercise: summary } = getSetsPerExercise(1, false, chestExercises);
      expect(summary[chestExercises[0]._id].count).toBe(3);
      expect(summary[chestExercises[1]._id].count).toBe(2);

      // Micro 2: total sets = (2 * 2) + 2 = 6 -> 3 and 3.
      const { setsGeneratedPerExercise: sum2 } = getSetsPerExercise(2, false, chestExercises);
      expect(sum2[chestExercises[0]._id].count).toBe(3);
      expect(sum2[chestExercises[1]._id].count).toBe(3);
    });
  });

  describe('Deload', () => {
    it('should drastically cut volume during deload', () => {
      const chestExercises: WorkoutExercise[] = [
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
        workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress
      ];

      // Deload: baseline is previous microcycle's set count, then halved (min 1).
      const { setsGeneratedPerExercise: summary, totalSets } = getSetsPerExercise(
        5,
        true,
        chestExercises
      );

      // Check total reduction
      expect(totalSets).toBeLessThan(10); // Definitely less than normal

      // Check specific logic (min 1 set)
      expect(Object.values(summary).every((s) => s.count >= 1)).toBe(true);
    });
  });
});
