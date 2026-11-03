import type { UUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import type { WorkoutExerciseCTO } from '../../../ctos/workout/WorkoutExerciseCTO.js';
import type { WorkoutMicrocycle } from '../../../documents/workout/WorkoutMicrocycle.js';
import type { WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import WorkoutExerciseService from '../Exercise/WorkoutExercise.service.js';
import type WorkoutMesocyclePlanContext from '../Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutSetService from './WorkoutSet.service.js';

describe('WorkoutSetService', () => {
  describe('isCompleted', () => {
    it('should return true when actualReps, actualWeight, and rir are all set', () => {
      const set = workoutTestUtil.createSet({
        overrides: {
          plannedReps: 10,
          plannedWeight: 100,
          plannedRir: 2,
          actualReps: 10,
          actualWeight: 100,
          rir: 2
        }
      });
      expect(WorkoutSetService.isCompleted(set)).toBe(true);
    });

    it('should return false when actualReps is null', () => {
      const set = workoutTestUtil.createSet({
        overrides: {
          plannedReps: 10,
          plannedWeight: 100,
          plannedRir: 2,
          actualWeight: 100,
          rir: 2
        }
      });
      expect(WorkoutSetService.isCompleted(set)).toBe(false);
    });

    it('should return false when actualWeight is null', () => {
      const set = workoutTestUtil.createSet({
        overrides: {
          plannedReps: 10,
          plannedWeight: 100,
          plannedRir: 2,
          actualReps: 10,
          rir: 2
        }
      });
      expect(WorkoutSetService.isCompleted(set)).toBe(false);
    });

    it('should return false when rir is null but plannedRir is set', () => {
      const set = workoutTestUtil.createSet({
        overrides: {
          plannedReps: 10,
          plannedWeight: 100,
          plannedRir: 2,
          actualReps: 10,
          actualWeight: 100
        }
      });
      expect(WorkoutSetService.isCompleted(set)).toBe(false);
    });

    it('should return true for deload sets (plannedRir null, rir null)', () => {
      const set = workoutTestUtil.createSet({
        overrides: {
          plannedReps: 5,
          plannedWeight: 50,
          plannedRir: null,
          actualReps: 5,
          actualWeight: 50,
          rir: null
        }
      });
      expect(WorkoutSetService.isCompleted(set)).toBe(true);
    });
  });

  describe('generateSetsForSessionExercise', () => {
    // Two rep-progression exercises, one per session, with distinct weights and rep ranges so
    // that progressing from the wrong exercise's history is unmistakable.
    const curlCTO = workoutTestUtil.createExerciseCTO({
      exercise: workoutTestUtil.STANDARD_EXERCISES.dumbbellCurl,
      calibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellCurl,
      equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell
    });
    const lateralRaiseCTO = workoutTestUtil.createExerciseCTO({
      exercise: workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise,
      calibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise,
      equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell
    });
    const plannedSessions = [[curlCTO], [lateralRaiseCTO]];

    /**
     * Generates completed history for the planned sessions, one microcycle per week. A count of 0
     * gives a mesocycle with no history, so planning falls back to calibration.
     */
    const generateHistory = (microcycleCount: number) => {
      const historyContext = workoutTestUtil.createContext({
        mesocycle: workoutTestUtil.createMesocycle({
          plannedSessionCountPerMicrocycle: plannedSessions.length,
          // The history plus the microcycle being planned, within the schema's two-microcycle minimum
          plannedMicrocycleCount: Math.max(microcycleCount + 1, 2),
          calibratedExercises: workoutTestUtil.getCalibrationIds(plannedSessions.flat())
        }),
        exerciseCTOs: plannedSessions.flat()
      });

      for (let index = 0; index < microcycleCount; index++) {
        workoutTestUtil.createHistoricalMicrocycle({
          context: historyContext,
          exerciseCTOs: plannedSessions,
          microcycleStartDate: new Date(2025, 0, 1 + index * 7)
        });
      }

      return historyContext;
    };

    /**
     * Reloads the generated history the way planning resumes from the database, then plans the
     * exercise's sets for the microcycle after that history.
     */
    const planNextSets = (
      historyContext: WorkoutMesocyclePlanContext,
      exerciseCTO: WorkoutExerciseCTO,
      { setCount = 1, isDeloadMicrocycle = false, sessionIndex = 0 } = {}
    ) => {
      const context = workoutTestUtil.reloadMesocyclePlanContext({
        context: historyContext,
        exerciseCTOs: plannedSessions.flat()
      });
      // Mesocycle generation lays out the sessions again before planning any microcycle
      context.setPlannedSessionExerciseCTOs(plannedSessions);
      const nextSession = workoutTestUtil.createSession({ title: 'Next Session' });

      WorkoutSetService.generateSetsForSessionExercise({
        context,
        exerciseCTO,
        session: nextSession,
        sessionExercise: workoutTestUtil.createSessionExercise({
          session: nextSession,
          exercise: exerciseCTO
        }),
        microcycleIndex: historyContext.microcyclesInOrder.length,
        sessionIndex,
        setCount,
        targetRir: isDeloadMicrocycle ? null : 2,
        isDeloadMicrocycle
      });

      return context.setsToCreate;
    };

    /**
     * Finds the first set an exercise was given in one microcycle of the generated history.
     */
    const findFirstSet = (
      historyContext: WorkoutMesocyclePlanContext,
      microcycleIndex: number,
      exerciseId: UUID
    ) => {
      const firstSetId =
        historyContext.microcyclesInOrder[microcycleIndex]?.exerciseToSessionExercise.get(
          exerciseId
        )?.setOrder[0];
      const set = firstSetId ? historyContext.setMap.get(firstSetId) : undefined;
      if (!set) {
        throw new Error(`No sets for exercise ${exerciseId} in microcycle ${microcycleIndex}`);
      }
      return set;
    };

    describe('within a session', () => {
      it('should drop reps by 2 for each subsequent set if theres room', () => {
        const sets = planNextSets(generateHistory(0), curlCTO, { setCount: 3 });

        const reps = sets.map((set) => set.plannedReps ?? 0);
        expect(reps).toEqual([reps[0], reps[0] - 2, reps[0] - 4]);
      });

      it('should drop weight and hold reps at the rep range floor if theres no room', () => {
        const sets = planNextSets(generateHistory(0), curlCTO, { setCount: 6 });

        const { plannedWeight: firstWeight } = sets[0];
        const { plannedWeight: lastWeight, plannedReps: lastReps } = sets[5];
        if (firstWeight == null || lastWeight == null) {
          throw new Error('Planned weight should be defined');
        }
        expect(lastWeight).toBeLessThan(firstWeight);
        expect(lastReps).toBeGreaterThanOrEqual(
          WorkoutExerciseService.getRepRangeValues(curlCTO.repRange).min
        );
      });
    });

    describe('progressing from previous microcycles', () => {
      /**
       * Deletes a microcycle's first session the way the app does, leaving the microcycle short a
       * session and that session's documents gone.
       */
      const deleteFirstSession = (
        historyContext: WorkoutMesocyclePlanContext,
        microcycle: WorkoutMicrocycle
      ) => {
        workoutTestUtil.deleteSessionFromMicrocycle({
          context: historyContext,
          microcycle,
          sessionId: microcycle.sessionOrder[0]
        });
      };

      /**
       * Rep-progression exercises hold their weight and add two reps when the previous
       * performance matched the plan, which is what the generated history logs.
       */
      const expectProgressionFrom = (plannedSet: WorkoutSet, previousSet: WorkoutSet) => {
        expect(plannedSet.plannedWeight).toBe(previousSet.plannedWeight);
        expect(plannedSet.plannedReps).toBe((previousSet.plannedReps ?? 0) + 2);
      };

      it("should progress from an exercise's own sets when the previous microcycle is missing its first session", () => {
        const historyContext = generateHistory(2);
        const { microcycle } = historyContext.microcyclesInOrder[1];
        const lateralRaisePreviousSet = findFirstSet(historyContext, 1, lateralRaiseCTO._id);
        deleteFirstSession(historyContext, microcycle);

        const [plannedSet] = planNextSets(historyContext, lateralRaiseCTO);

        expectProgressionFrom(plannedSet, lateralRaisePreviousSet);
      });

      it("should progress from an exercise's own sets when the previous microcycle's sessions are out of plan order", () => {
        const historyContext = generateHistory(1);
        const { microcycle } = historyContext.microcyclesInOrder[0];
        microcycle.sessionOrder.reverse();

        const [curlSet] = planNextSets(historyContext, curlCTO);
        const [lateralRaiseSet] = planNextSets(historyContext, lateralRaiseCTO);

        expectProgressionFrom(curlSet, findFirstSet(historyContext, 0, curlCTO._id));
        expectProgressionFrom(
          lateralRaiseSet,
          findFirstSet(historyContext, 0, lateralRaiseCTO._id)
        );
      });

      it('should progress from the most recent microcycle that has the exercise', () => {
        const historyContext = generateHistory(2);
        const { microcycle } = historyContext.microcyclesInOrder[1];
        const curlSetBeforeRemoval = findFirstSet(historyContext, 1, curlCTO._id);
        deleteFirstSession(historyContext, microcycle);

        const [plannedSet] = planNextSets(historyContext, curlCTO);

        const previousSet = findFirstSet(historyContext, 0, curlCTO._id);
        expectProgressionFrom(plannedSet, previousSet);
        expect(plannedSet.plannedReps).not.toBe((curlSetBeforeRemoval.plannedReps ?? 0) + 2);
      });

      it('should skip a recovery entry and progress from the microcycle before it', () => {
        const historyContext = generateHistory(2);
        const recoveryEntry = historyContext.microcyclesInOrder[1]?.exerciseToSessionExercise.get(
          curlCTO._id
        );
        if (!recoveryEntry) {
          throw new Error('Expected the curl to be in the last historical microcycle');
        }
        recoveryEntry.isRecoveryExercise = true;

        const [plannedSet] = planNextSets(historyContext, curlCTO);

        expectProgressionFrom(plannedSet, findFirstSet(historyContext, 0, curlCTO._id));
      });

      it('should fall back to calibration for an exercise with no history in the mesocycle', () => {
        const calfRaiseCTO = workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.dumbbellCalfRaise,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellCalfRaise,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell
        });

        const [plannedSet] = planNextSets(generateHistory(2), calfRaiseCTO);

        const [calibrationSet] = planNextSets(generateHistory(0), calfRaiseCTO);
        expect(plannedSet.plannedWeight).toBe(calibrationSet.plannedWeight);
        expect(plannedSet.plannedReps).toBe(calibrationSet.plannedReps);
      });
    });

    describe('deload microcycles', () => {
      /**
       * Expects every planned set to be the same straight set.
       */
      const expectStraightSets = (
        plannedSets: WorkoutSet[],
        expected: Pick<WorkoutSet, 'plannedReps' | 'plannedWeight'>
      ) => {
        expect(
          plannedSets.map(({ plannedReps, plannedWeight }) => ({ plannedReps, plannedWeight }))
        ).toEqual(plannedSets.map(() => expected));
      };

      it("should repeat the previous microcycle's first set at half the reps in the first half", () => {
        const historyContext = generateHistory(2);
        const previousSet = findFirstSet(historyContext, 1, curlCTO._id);

        const plannedSets = planNextSets(historyContext, curlCTO, {
          setCount: 2,
          isDeloadMicrocycle: true
        });

        expectStraightSets(plannedSets, {
          plannedReps: Math.floor((previousSet.actualReps ?? 0) / 2),
          plannedWeight: previousSet.actualWeight
        });
      });

      it("should halve the previous microcycle's first set weight in the second half", () => {
        const historyContext = generateHistory(2);
        const previousSet = findFirstSet(historyContext, 1, lateralRaiseCTO._id);

        const plannedSets = planNextSets(historyContext, lateralRaiseCTO, {
          setCount: 2,
          isDeloadMicrocycle: true,
          sessionIndex: 1
        });

        const [firstSet] = plannedSets;
        expect(firstSet.plannedWeight).toBeLessThan(previousSet.actualWeight ?? 0);
        expectStraightSets(plannedSets, {
          plannedReps: Math.floor((previousSet.actualReps ?? 0) / 2),
          plannedWeight: firstSet.plannedWeight
        });
      });

      it('should halve the progressed first set when the exercise has no history in the mesocycle', () => {
        const historyContext = generateHistory(0);

        const [progressedSet] = planNextSets(historyContext, curlCTO);
        const deloadSets = planNextSets(historyContext, curlCTO, {
          setCount: 2,
          isDeloadMicrocycle: true
        });

        expectStraightSets(deloadSets, {
          plannedReps: Math.floor((progressedSet.plannedReps ?? 0) / 2),
          plannedWeight: progressedSet.plannedWeight
        });
      });
    });
  });
});
