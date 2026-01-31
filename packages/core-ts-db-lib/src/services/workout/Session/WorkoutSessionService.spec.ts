import { describe, expect, it, vi } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import type { WorkoutExercise } from '../../../documents/workout/WorkoutExercise.js';
import WorkoutMesocyclePlanContext from '../Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutSessionExerciseService from '../SessionExercise/WorkoutSessionExerciseService.js';
import WorkoutSessionService from './WorkoutSessionService.js';

describe('WorkoutSessionService', () => {
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

    const setPlan = WorkoutSessionService.calculateSetPlanForMicrocycle(
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

  describe('Set Distribution Logic', () => {
    const mesocycleLogic = workoutTestUtil.createMesocycle({
      plannedSessionCountPerMicrocycle: 1,
      calibratedExercises: [workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat._id]
    });

    const createWorkoutExercise = (props: Partial<WorkoutExercise> = {}) => {
      return workoutTestUtil.createExercise({
        exerciseName: 'Test Exercise',
        primaryMuscleGroups: [workoutTestUtil.STANDARD_MUSCLE_GROUPS.quads._id],
        initialFatigueGuess: {
          jointAndTissueDisruption: 0,
          perceivedEffort: 0,
          unusedMusclePerformance: 0
        },
        ...props
      });
    };

    const generateContext = (exercises: WorkoutExercise[]) => {
      const context = workoutTestUtil.createContext({
        mesocycle: mesocycleLogic,
        calibrations: [],
        exercises
      });

      const pairs = exercises.map((ex) => ({
        exercise: ex,
        calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat
      }));
      context.setPlannedSessionExercisePairs([pairs]);
      context.muscleGroupToExercisePairsMap = new Map([
        [workoutTestUtil.STANDARD_MUSCLE_GROUPS.quads._id, pairs]
      ]);

      return context;
    };

    const setupPreviousSession = (
      context: WorkoutMesocyclePlanContext,
      microcycleIndex: number,
      exercises: WorkoutExercise[]
    ) => {
      const prevMicro = workoutTestUtil.createMicrocycle({
        mesocycle: mesocycleLogic,
        startDate: new Date(),
        endDate: new Date()
      });
      context.microcyclesInOrder[microcycleIndex - 1] = prevMicro;

      const prevSession = workoutTestUtil.createSession({
        microcycle: prevMicro,
        title: 'Prev Session'
      });
      context.existingSessions.push(prevSession);

      exercises.forEach((ex) => {
        const se = workoutTestUtil.createSessionExercise({
          session: prevSession,
          exercise: ex,
          overrides: { setOrder: [] }
        });
        context.existingSessionExercises.push(se);
      });
    };

    const setupAndRun = (
      sfrA: number,
      sfrB: number,
      recommendedSetAdditionA: number,
      recommendedSetAdditionB: number
    ) => {
      const exA = createWorkoutExercise({ exerciseName: 'Ex A' });
      const exB = createWorkoutExercise({ exerciseName: 'Ex B' });

      const context = generateContext([exA, exB]);
      setupPreviousSession(context, 1, [exA, exB]);

      // Mock Baseline to 0 to only see added sets
      vi.spyOn(WorkoutSessionService, 'calculateBaselineSetCount').mockReturnValue(0);

      // Mock Recommendation
      vi.spyOn(
        WorkoutSessionExerciseService,
        'getRecommendedSetAdditionsOrRecovery'
      ).mockImplementation((se) => {
        if (se.workoutExerciseId === exA._id) return recommendedSetAdditionA;
        if (se.workoutExerciseId === exB._id) return recommendedSetAdditionB;
        return 0;
      });

      // Mock SFR
      vi.spyOn(WorkoutSessionExerciseService, 'getSFR').mockImplementation((se) => {
        if (se.workoutExerciseId === exA._id) return sfrA;
        if (se.workoutExerciseId === exB._id) return sfrB;
        return 0;
      });

      const result = WorkoutSessionService.calculateSetPlanForMicrocycle(context, 1, false);
      const map = result.setCountByExerciseId;

      vi.restoreAllMocks(); // Cleanup

      return {
        countA: map.get(exA._id) ?? 0,
        countB: map.get(exB._id) ?? 0,
        map
      };
    };

    it('should choose the exercise that comes first in the microcycle when SFR is equal and 1 set to add', () => {
      const { countA, countB } = setupAndRun(10, 10, 0.5, 0.5);
      expect(countA).toBe(1);
      expect(countB).toBe(0);
    });

    it('should split evenly between the two exercises when SFR is equal and 2 sets to add', () => {
      const { countA, countB } = setupAndRun(10, 10, 1, 1);
      expect(countA).toBe(1);
      expect(countB).toBe(1);
    });

    it('should add 2 sets to the higher SFR exercise when SFR is higher and 2 sets to add', () => {
      const { countA, countB } = setupAndRun(12, 10, 1, 1);
      expect(countA).toBe(2);
      expect(countB).toBe(0);
    });
  });
});
