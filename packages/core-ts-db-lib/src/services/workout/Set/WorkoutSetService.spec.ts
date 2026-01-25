import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import {
  ExerciseProgressionType,
  ExerciseRepRange,
  type WorkoutExercise
} from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutExerciseCalibration } from '../../../documents/workout/WorkoutExerciseCalibration.js';
import { CycleType, WorkoutMesocycleSchema } from '../../../documents/workout/WorkoutMesocycle.js';
import { WorkoutSessionSchema } from '../../../documents/workout/WorkoutSession.js';
import { WorkoutSessionExerciseSchema } from '../../../documents/workout/WorkoutSessionExercise.js';
import DocumentService from '../../../services/DocumentService.js';
import WorkoutMesocyclePlanContext from '../Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutSetService from './WorkoutSetService.js';

describe('WorkoutSetService', () => {
  describe('generateSetsForSessionExercise', () => {
    const exercise = workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise; // Light Rep Range (15-30)

    const session = WorkoutSessionSchema.parse({
      userId: workoutTestUtil.userId,
      workoutMicrocycleId: DocumentService.generateID(),
      title: 'Test Session',
      startTime: new Date()
    });

    const sessionExercise = WorkoutSessionExerciseSchema.parse({
      userId: workoutTestUtil.userId,
      workoutSessionId: session._id,
      workoutExerciseId: exercise._id,
      sets: []
    });

    const mesocycle = WorkoutMesocycleSchema.parse({
      userId: workoutTestUtil.userId,
      cycleType: CycleType.MuscleGain,
      plannedMicrocycleLengthInDays: 7,
      plannedSessionCountPerMicrocycle: 1, // Reduced to pass schema validation with minimal exercises
      calibratedExercises: [workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise._id]
    });

    // Helper to run the service
    const runGeneration = (params: {
      currentExercise: WorkoutExercise;
      currentCalibration: WorkoutExerciseCalibration;
      microcycleIndex?: number;
      targetRir?: number;
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

      // Use all standard equipment so any exercise works
      const context = new WorkoutMesocyclePlanContext(
        mesocycle,
        [currentCalibration],
        [currentExercise],
        Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES)
      );

      WorkoutSetService.generateSetsForSessionExercise({
        context,
        exercise: currentExercise,
        calibration: currentCalibration,
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
  });
});
