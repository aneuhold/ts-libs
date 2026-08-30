import type { UUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import type { WorkoutExerciseCTO } from '../../../ctos/workout/WorkoutExerciseCTO.js';
import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';
import {
  ExerciseProgressionType,
  ExerciseRepRange,
  type WorkoutExercise
} from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutExerciseCalibration } from '../../../documents/workout/WorkoutExerciseCalibration.js';
import type { WorkoutMicrocycle } from '../../../documents/workout/WorkoutMicrocycle.js';
import type { WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
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
    const exercise = workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise; // Light Rep Range (15-30)

    const session = workoutTestUtil.createSession({
      title: 'Test Session'
    });

    const sessionExercise = workoutTestUtil.createSessionExercise({
      session,
      exercise,
      overrides: { setOrder: [] }
    });

    const mesocycle = workoutTestUtil.createMesocycle({
      plannedSessionCountPerMicrocycle: 1, // Reduced to pass schema validation with minimal exercises
      calibratedExercises: [workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise._id]
    });

    // Helper to run the service
    const runGeneration = (params: {
      currentExercise: WorkoutExercise;
      currentCalibration: WorkoutExerciseCalibration;
      equipmentType?: WorkoutEquipmentType;
      microcycleIndex?: number;
      targetRir?: number | null;
      isDeload?: boolean;
      setCountOverride?: number;
    }) => {
      const {
        currentExercise,
        currentCalibration,
        microcycleIndex = 0,
        targetRir = 2,
        isDeload = false,
        setCountOverride = 3
      } = params;

      const resolvedEquipmentType =
        params.equipmentType ??
        Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES).find(
          (et) => et._id === currentExercise.workoutEquipmentTypeId
        );

      const exerciseCTO = workoutTestUtil.createExerciseCTO({
        exercise: currentExercise,
        calibration: currentCalibration,
        equipmentType: resolvedEquipmentType
      });

      const context = workoutTestUtil.createContext({
        mesocycle,
        exerciseCTOs: [exerciseCTO]
      });

      WorkoutSetService.generateSetsForSessionExercise({
        context,
        exerciseCTO,
        session,
        sessionExercise,
        microcycleIndex,
        sessionIndex: 0,
        setCount: setCountOverride,
        targetRir,
        isDeloadMicrocycle: isDeload
      });

      return context.setsToCreate;
    };

    it('should drop reps by 2 for each subsequent set under normal fatigue conditions', () => {
      // Setup: Medium Range Exercise (10-20), High Reps initially to allow drops
      const testExercise = {
        ...workoutTestUtil.STANDARD_EXERCISES.dumbbellCurl, // Medium range
        repRange: ExerciseRepRange.Medium
      };

      const sets = runGeneration({
        currentExercise: testExercise,
        currentCalibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellCurl,
        setCountOverride: 3
      });

      expect(sets).toHaveLength(3);
      const repCounts = sets.map((s) => s.plannedReps);

      // We expect something like 15, 13, 11 (starting reps may vary based on 1RM calc, likely close to 15)
      const r0 = repCounts[0];
      const r1 = repCounts[1];
      const r2 = repCounts[2];
      if (!r0 || !r1 || !r2) {
        throw new Error('Planned reps should be defined for all sets');
      }

      expect(r1).toBe(r0 - 2);
      expect(r2).toBe(r1 - 2);
    });

    it('should drop weight and maintain reps when hitting the rep floor', () => {
      const testExercise = {
        ...workoutTestUtil.STANDARD_EXERCISES.dumbbellCurl,
        repRange: ExerciseRepRange.Medium,
        preferredProgressionType: ExerciseProgressionType.Rep
      };

      const sets = runGeneration({
        currentExercise: testExercise,
        currentCalibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellCurl,
        setCountOverride: 6
      });

      const set1 = sets[0];
      const set6 = sets[5];

      expect(set1.plannedWeight).toBeDefined();
      expect(set6.plannedWeight).toBeDefined();

      if (!set6.plannedWeight || !set1.plannedWeight) {
        throw new Error('Planned weight should be defined');
      }

      expect(set6.plannedWeight).toBeLessThan(set1.plannedWeight);
      // Reps should be maintained or at least not dropped below meaningful threshold
      expect(set6.plannedReps).toBeGreaterThanOrEqual(10);
    });

    it('should reduce volume and intensity during a deload microcycle', () => {
      const testExercise = workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress;
      const testCalibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress;

      // Normal Generation
      const normalSets = runGeneration({
        currentExercise: testExercise,
        currentCalibration: testCalibration,
        isDeload: false,
        setCountOverride: 3
      });

      // Deload Generation
      const deloadSets = runGeneration({
        currentExercise: testExercise,
        currentCalibration: testCalibration,
        isDeload: true,
        targetRir: null,
        setCountOverride: 3
      });

      expect(deloadSets).toHaveLength(3);

      // Expect drastic rep reduction (Half)
      // Normal: ~10 reps. Deload: ~5 reps.
      expect(deloadSets[0].plannedReps).toBeDefined();
      expect(normalSets[0].plannedReps).toBeDefined();
      if (!deloadSets[0].plannedReps || !normalSets[0].plannedReps) {
        throw new Error('Planned reps should be defined');
      }
      expect(deloadSets[0].plannedReps).toBeLessThan(normalSets[0].plannedReps * 0.7);
      expect(deloadSets[1].plannedReps).toBeDefined();
      if (!deloadSets[1].plannedReps) {
        throw new Error('Planned reps should be defined');
      }
      expect(deloadSets[1].plannedReps).toBeGreaterThan(deloadSets[0].plannedReps / 2);
    });

    describe('resolving the previous microcycle', () => {
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
       * Generates completed history for the planned sessions, one microcycle per week.
       */
      const generateHistory = (microcycleCount: number) => {
        const historyContext = workoutTestUtil.createContext({
          mesocycle: workoutTestUtil.createMesocycle({
            plannedSessionCountPerMicrocycle: plannedSessions.length,
            plannedMicrocycleCount: microcycleCount + 1,
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
       * exercise's first set for the microcycle after that history.
       */
      const planNextFirstSet = (
        historyContext: WorkoutMesocyclePlanContext,
        exerciseCTO: WorkoutExerciseCTO
      ) => {
        const microcycleCount = historyContext.microcyclesInOrder.length;
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
          microcycleIndex: microcycleCount,
          sessionIndex: 0,
          setCount: 1,
          targetRir: 2,
          isDeloadMicrocycle: false
        });

        return context.setsToCreate[0];
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

        const plannedSet = planNextFirstSet(historyContext, lateralRaiseCTO);

        expectProgressionFrom(plannedSet, lateralRaisePreviousSet);
      });

      it("should progress from an exercise's own sets when the previous microcycle's sessions are out of plan order", () => {
        const historyContext = generateHistory(1);
        const { microcycle } = historyContext.microcyclesInOrder[0];
        microcycle.sessionOrder.reverse();

        const curlSet = planNextFirstSet(historyContext, curlCTO);
        const lateralRaiseSet = planNextFirstSet(historyContext, lateralRaiseCTO);

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

        const plannedSet = planNextFirstSet(historyContext, curlCTO);

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

        const plannedSet = planNextFirstSet(historyContext, curlCTO);

        expectProgressionFrom(plannedSet, findFirstSet(historyContext, 0, curlCTO._id));
      });

      it('should fall back to calibration for an exercise with no history in the mesocycle', () => {
        const historyContext = generateHistory(2);
        const calfRaiseCTO = workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.dumbbellCalfRaise,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellCalfRaise,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell
        });

        const plannedSet = planNextFirstSet(historyContext, calfRaiseCTO);

        const calibrationSet = runGeneration({
          currentExercise: workoutTestUtil.STANDARD_EXERCISES.dumbbellCalfRaise,
          currentCalibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellCalfRaise,
          setCountOverride: 1
        })[0];
        expect(plannedSet.plannedWeight).toBe(calibrationSet.plannedWeight);
        expect(plannedSet.plannedReps).toBe(calibrationSet.plannedReps);
      });
    });

    it('should not plan higher weight in a deload than the previous accumulation microcycle', () => {
      // Use a rep-progression exercise where the extra microcycle iteration would
      // cause a weight bump if the deload index were used directly.
      // dumbbellLateralRaise: Light range (15-30), Rep progression.
      // With midpoint 22 and +2 reps/microcycle, reps hit 30 at MC 4 and would
      // overflow at MC 5, triggering a weight bump if the raw index were used.
      const testExercise = workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise;
      const testCalibration = workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise;

      const lastAccumulationSets = runGeneration({
        currentExercise: testExercise,
        currentCalibration: testCalibration,
        microcycleIndex: 4,
        targetRir: 0,
        isDeload: false,
        setCountOverride: 1
      });

      const deloadSets = runGeneration({
        currentExercise: testExercise,
        currentCalibration: testCalibration,
        microcycleIndex: 5,
        targetRir: null,
        isDeload: true,
        setCountOverride: 1
      });

      const accumulationWeight = lastAccumulationSets[0].plannedWeight;
      const deloadWeight = deloadSets[0].plannedWeight;
      if (accumulationWeight == null || deloadWeight == null) {
        throw new Error('Planned weight should be defined');
      }

      expect(deloadWeight).toBeLessThanOrEqual(accumulationWeight);
    });
  });
});
