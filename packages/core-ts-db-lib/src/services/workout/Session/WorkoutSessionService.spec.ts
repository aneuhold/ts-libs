import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import { CycleType, WorkoutMesocycleSchema } from '../../../documents/workout/WorkoutMesocycle.js';
import { WorkoutMicrocycleSchema } from '../../../documents/workout/WorkoutMicrocycle.js';
import WorkoutMesocyclePlanContext from '../Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutSessionService from './WorkoutSessionService.js';

describe('WorkoutSessionService', () => {
  const mesocycle = WorkoutMesocycleSchema.parse({
    userId: workoutTestUtil.userId,
    cycleType: CycleType.MuscleGain,
    plannedMicrocycleLengthInDays: 7,
    plannedSessionCountPerMicrocycle: 4,
    calibratedExercises: [
      workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat._id,
      workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress._id,
      workoutTestUtil.STANDARD_CALIBRATIONS.cableRow._id,
      workoutTestUtil.STANDARD_CALIBRATIONS.deadlift._id
    ]
  });

  const exercises = [
    workoutTestUtil.STANDARD_EXERCISES.barbellSquat,
    workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
    workoutTestUtil.STANDARD_EXERCISES.cableRow
  ];

  // Mapped couples for input
  const exerciseList = exercises.map((ex) => ({
    exercise: ex,
    calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat // reused cal, doesn't matter for set count
  }));

  // Helper to generate a session and inspect set counts
  const getSetsPerExercise = (microcycleIndex: number, isDeload: boolean = false) => {
    const context = new WorkoutMesocyclePlanContext(
      mesocycle,
      [workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat],
      exercises,
      Object.values(workoutTestUtil.STANDARD_EQUIPMENT_TYPES)
    );

    // Populate dummy microcycles so that when generateSession looks for context.microcyclesToCreate[index], it exists.
    // We need to fill up to microcycleIndex.
    for (let i = 0; i <= microcycleIndex; i++) {
      context.microcyclesToCreate.push(
        WorkoutMicrocycleSchema.parse({
          userId: workoutTestUtil.userId,
          workoutMesocycleId: mesocycle._id,
          startDate: new Date(),
          endDate: new Date()
        })
      );
    }

    WorkoutSessionService.generateSession({
      context,
      microcycleIndex,
      sessionIndex: 0,
      sessionStartDate: new Date(),
      sessionExerciseList: exerciseList,
      targetRir: 2,
      isDeloadMicrocycle: isDeload
    });

    // Count sets generated per exercise
    // result is in `context.setsToCreate`
    // We map them back to which exercise they belong to.
    const setsGeneratedPerExercise: Record<string, { exerciseName: string; count: number }> = {};
    let totalSets = 0;

    exerciseList.forEach((pair) => {
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
    it('should increase total set volume with microcycle index', () => {
      // Formula: (2 * Exercises) + Microcycle
      // 3 Exercises.
      // Micro 0: 6 + 0 = 6
      // Micro 1: 6 + 1 = 7
      // Micro 2: 6 + 2 = 8

      const m0 = getSetsPerExercise(0);
      expect(m0.totalSets).toBe(6);

      const m1 = getSetsPerExercise(1);
      expect(m1.totalSets).toBe(7);

      const m2 = getSetsPerExercise(2);
      expect(m2.totalSets).toBe(8);
    });

    it('should distribute extra sets to earlier exercises', () => {
      // Micro 1: 7 sets. 3 Exercises. Base 2. Remainder 1.
      // Ex 1 should get 3. Ex 2 & 3 get 2.
      const { setsGeneratedPerExercise: summary } = getSetsPerExercise(1);
      expect(summary[exercises[0]._id].count).toBe(3);
      expect(summary[exercises[1]._id].count).toBe(2);
      expect(summary[exercises[2]._id].count).toBe(2);

      // Micro 2: 8 sets. Remainder 2.
      // Ex 1 & 2 get 3. Ex 3 gets 2.
      const { setsGeneratedPerExercise: sum2 } = getSetsPerExercise(2);
      expect(sum2[exercises[0]._id].count).toBe(3);
      expect(sum2[exercises[1]._id].count).toBe(3);
      expect(sum2[exercises[2]._id].count).toBe(2);
    });
  });

  describe('Deload', () => {
    it('should drastically cut volume during deload', () => {
      // Micro 5 (normally High Volume: 6 + 5 = 11 sets)
      // Deload: Should look at "Baseline" (Micro 4 logic) and half it?
      // Logic in file: calculate baseline (Micro - 1), then half.
      // Baseline Micro 4: 6 + 4 = 10 sets.
      // Deload sets per exercise = floor(Baseline / 2).
      // Wait, logic is per exercise.
      // Ex 1 Baseline (Micro 4): 10 sets distributed -> 4, 3, 3.
      // Deload Ex 1: floor(4 / 2) = 2.
      // Deload Ex 2: floor(3 / 2) = 1.
      // Deload Ex 3: floor(3 / 2) = 1.
      // Total = 4 sets.

      const { setsGeneratedPerExercise: summary, totalSets } = getSetsPerExercise(5, true);

      // Check total reduction
      expect(totalSets).toBeLessThan(10); // Definitely less than normal

      // Check specific logic (min 1 set)
      expect(Object.values(summary).every((s) => s.count >= 1)).toBe(true);
    });
  });
});
