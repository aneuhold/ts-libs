import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import type { WorkoutExercise } from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutExerciseCalibration } from '../../../documents/workout/WorkoutExerciseCalibration.js';
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

  describe('calculateSetPlanForMicrocycle', () => {
    it('should calculate baseline set counts for first microcycle without history', () => {
      const chestExercises: WorkoutExercise[] = [
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
        workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress
      ];

      const { result } = calculateSetPlan({
        exercises: chestExercises,
        calibrations: [
          {
            exercise: chestExercises[0],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress
          },
          {
            exercise: chestExercises[1],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress
          }
        ]
      });

      // Microcycle 0: 2 exercises * 2 sets = 4 total sets
      expect(result.exerciseIdToSetCount.get(chestExercises[0]._id)).toBe(2);
      expect(result.exerciseIdToSetCount.get(chestExercises[1]._id)).toBe(2);
      expect(result.recoveryExerciseIds.size).toBe(0);
    });

    it('should prioritize adding sets to lower-set exercise when higher-SFR exercise is at max (8 sets)', () => {
      const chestExercises: WorkoutExercise[] = [
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
        workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress
      ];

      // Exercise A (bench press): 8 sets, high SFR (soreness=0, performance=0 -> +2 recommendation)
      // Exercise B (incline): 3 sets, moderate SFR (soreness=1, performance=1 -> +0 recommendation)
      const { result } = calculateSetPlan({
        exercises: chestExercises,
        calibrations: [
          {
            exercise: chestExercises[0],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress
          },
          {
            exercise: chestExercises[1],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress
          }
        ],
        microcycleIndex: 1,
        sessionStructure: [[0], [1]], // Exercise A in session 0, Exercise B in session 1
        historicalMicrocycles: [
          {
            sessionExerciseOverrides: [
              [{ setCount: 8, sorenessScore: 0, performanceScore: 0 }], // Session 0: Exercise A
              [{ setCount: 3, sorenessScore: 1, performanceScore: 1 }] // Session 1: Exercise B
            ]
          }
        ]
      });

      // Exercise A should remain at 8 sets (can't exceed MAX_SETS_PER_EXERCISE)
      expect(result.exerciseIdToSetCount.get(chestExercises[0]._id)).toBe(8);

      // Exercise B should get the recommended sets that Exercise A couldn't receive (3 + 2 = 5)
      expect(result.exerciseIdToSetCount.get(chestExercises[1]._id)).toBe(5);
    });

    it('should redistribute sets from 2 blocked exercises in same session to 1 exercise in separate session', () => {
      const chestExercises: WorkoutExercise[] = [
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
        workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress,
        workoutTestUtil.STANDARD_EXERCISES.dumbbellChestPress
      ];

      // Exercise A (bench): 8 sets, higher SFR (soreness=0, performance=1 -> +1 recommendation)
      // Exercise B (incline): 8 sets, higher SFR (soreness=0, performance=1 -> +1 recommendation)
      // Exercise C (dumbbell): 5 sets, lower SFR (soreness=1, performance=1 -> +0 recommendation)
      const { result } = calculateSetPlan({
        exercises: chestExercises,
        calibrations: [
          {
            exercise: chestExercises[0],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress
          },
          {
            exercise: chestExercises[1],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress
          },
          {
            exercise: chestExercises[2],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellChestPress
          }
        ],
        microcycleIndex: 1,
        sessionStructure: [[0, 1], [2]], // Exercises A and B in session 0, Exercise C in session 1
        historicalMicrocycles: [
          {
            sessionExerciseOverrides: [
              [
                { setCount: 5, sorenessScore: 0, performanceScore: 1 }, // Exercise A
                { setCount: 5, sorenessScore: 0, performanceScore: 1 } // Exercise B
              ],
              [{ setCount: 5, sorenessScore: 1, performanceScore: 1 }] // Exercise C
            ]
          }
        ]
      });

      // Exercises A and B remain at 8 sets (at MAX_SETS_PER_EXERCISE)
      expect(result.exerciseIdToSetCount.get(chestExercises[0]._id)).toBe(5);
      expect(result.exerciseIdToSetCount.get(chestExercises[1]._id)).toBe(5);

      // Exercise C gets its own +0 recommendation plus the 2 redistributed from A and B (5 + 0 + 2 = 7)
      expect(result.exerciseIdToSetCount.get(chestExercises[2]._id)).toBe(7);
    });

    it('should redistribute sets when session cap prevents second-highest SFR exercise from receiving sets', () => {
      const chestExercises: WorkoutExercise[] = [
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
        workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress,
        workoutTestUtil.STANDARD_EXERCISES.dumbbellChestPress
      ];

      // Exercise A (bench): 4 sets, highest SFR (soreness=0, performance=1 -> +1 recommendation)
      // Exercise B (incline): 5 sets, second SFR (soreness=0, performance=1 -> +1 recommendation)
      // Exercise C (dumbbell): 3 sets, third SFR (soreness=1, performance=0 -> +1 recommendation)
      // Total sets to add: 3. Session 0 already has 9 sets (4+5), so adding 1 to A caps it at 10.
      // B cannot receive sets due to session cap, so its +1 is redistributed to C.
      const { result } = calculateSetPlan({
        exercises: chestExercises,
        calibrations: [
          {
            exercise: chestExercises[0],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress
          },
          {
            exercise: chestExercises[1],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress
          },
          {
            exercise: chestExercises[2],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellChestPress
          }
        ],
        microcycleIndex: 1,
        sessionStructure: [[0, 1], [2]], // Exercises A and B in session 0, Exercise C in session 1
        historicalMicrocycles: [
          {
            sessionExerciseOverrides: [
              [
                { setCount: 4, sorenessScore: 0, performanceScore: 1 }, // Exercise A (highest SFR)
                { setCount: 5, sorenessScore: 0, performanceScore: 1 } // Exercise B (second SFR)
              ],
              [{ setCount: 3, sorenessScore: 1, performanceScore: 0 }] // Exercise C (third SFR)
            ]
          }
        ]
      });

      // Exercise A gets +1 (4 → 5), bringing session 0 to MAX_SETS_PER_MUSCLE_GROUP_PER_SESSION
      expect(result.exerciseIdToSetCount.get(chestExercises[0]._id)).toBe(5);

      // Exercise B remains at 5 (session is capped)
      expect(result.exerciseIdToSetCount.get(chestExercises[1]._id)).toBe(5);

      // Exercise C gets its own +1 plus B's redistributed +1 (3 + 1 + 1 = 5)
      expect(result.exerciseIdToSetCount.get(chestExercises[2]._id)).toBe(5);
    });

    /**
     * Helper to set up context and call calculateSetPlanForMicrocycle
     */
    function calculateSetPlan(options: {
      exercises: WorkoutExercise[];
      calibrations: { exercise: WorkoutExercise; calibration: WorkoutExerciseCalibration }[];
      microcycleIndex?: number;
      isDeload?: boolean;
      sessionStructure?: number[][];
      historicalMicrocycles?: Array<{
        sessionExerciseOverrides?: Array<
          Array<{
            setCount?: number;
            sorenessScore?: number;
            performanceScore?: number;
          }>
        >;
      }>;
    }) {
      const {
        exercises,
        calibrations,
        microcycleIndex = 0,
        isDeload = false,
        sessionStructure = [[0, 1]],
        historicalMicrocycles = []
      } = options;

      // Create default mesocycle if not provided, with session count matching sessionStructure
      const mesocycle = workoutTestUtil.createMesocycle({
        plannedSessionCountPerMicrocycle: sessionStructure.length,
        calibratedExercises: calibrations.map((c) => c.calibration._id)
      });

      const context = workoutTestUtil.createContext({
        mesocycle,
        calibrations: calibrations.map((c) => c.calibration),
        exercises
      });

      // Build exercise pairs based on session structure
      const exercisePairs = sessionStructure.map((sessionExerciseIndices) =>
        sessionExerciseIndices.map((exerciseIndex) => ({
          exercise: exercises[exerciseIndex],
          calibration: calibrations[exerciseIndex].calibration
        }))
      );

      // Create historical microcycles with performance data
      historicalMicrocycles.forEach((historicalData) => {
        workoutTestUtil.createHistoricalMicrocycle({
          context,
          exercisePairs,
          targetRir: 2,
          isDeloadMicrocycle: false,
          sessionExerciseOverrides: historicalData.sessionExerciseOverrides
        });
      });

      // Add the current microcycle being planned
      context.addMicrocycle(workoutTestUtil.createMicrocycle({ mesocycle }));

      context.setPlannedSessionExercisePairs(exercisePairs);

      const result = WorkoutSessionService.calculateSetPlanForMicrocycle(
        context,
        microcycleIndex,
        isDeload
      );

      return { context, result };
    }
  });
});
