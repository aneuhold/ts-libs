import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../../test-utils/WorkoutTestUtil.js';
import type { WorkoutExercise } from '../../../../documents/workout/WorkoutExercise.js';
import type { WorkoutExerciseCalibration } from '../../../../documents/workout/WorkoutExerciseCalibration.js';
import type { Fatigue } from '../../../../embedded-types/workout/Fatigue.js';
import type { RSM } from '../../../../embedded-types/workout/Rsm.js';
import WorkoutVolumePlanningService from './WorkoutVolumePlanningService.js';

describe('WorkoutVolumePlanningService', () => {
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

      // Exercise A (bench press): 8 sets, high SFR (rsm=9, fatigue=3 -> SFR=3, soreness=0, performance=0 -> +2 recommendation)
      // Exercise B (incline): 3 sets, moderate SFR (rsm=6, fatigue=4 -> SFR=1.5, soreness=1, performance=1 -> +0 recommendation)
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
              [
                {
                  setCount: 8,
                  sorenessScore: 0,
                  performanceScore: 0,
                  rsm: { mindMuscleConnection: 3, pump: 3, disruption: 3 }, // Total: 9
                  fatigue: {
                    jointAndTissueDisruption: 1,
                    perceivedEffort: 1,
                    unusedMusclePerformance: 1
                  } // Total: 3, SFR = 3
                }
              ], // Session 0: Exercise A
              [
                {
                  setCount: 3,
                  sorenessScore: 1,
                  performanceScore: 1,
                  rsm: { mindMuscleConnection: 2, pump: 2, disruption: 2 }, // Total: 6
                  fatigue: {
                    jointAndTissueDisruption: 1,
                    perceivedEffort: 2,
                    unusedMusclePerformance: 1
                  } // Total: 4, SFR = 1.5
                }
              ] // Session 1: Exercise B
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

      // Exercise A (bench): 5 sets, highest SFR (rsm=9, fatigue=3 -> SFR=3, soreness=0, performance=1 -> +1 recommendation)
      // Exercise B (incline): 5 sets, second SFR (rsm=8, fatigue=4 -> SFR=2, soreness=0, performance=1 -> +1 recommendation)
      // Exercise C (dumbbell): 5 sets, lower SFR (rsm=6, fatigue=6 -> SFR=1, soreness=1, performance=1 -> +0 recommendation)
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
                {
                  setCount: 5,
                  sorenessScore: 0,
                  performanceScore: 1,
                  rsm: { mindMuscleConnection: 3, pump: 3, disruption: 3 }, // Total: 9
                  fatigue: {
                    jointAndTissueDisruption: 1,
                    perceivedEffort: 1,
                    unusedMusclePerformance: 1
                  } // Total: 3, SFR = 3
                }, // Exercise A
                {
                  setCount: 5,
                  sorenessScore: 0,
                  performanceScore: 1,
                  rsm: { mindMuscleConnection: 3, pump: 3, disruption: 2 }, // Total: 8
                  fatigue: {
                    jointAndTissueDisruption: 1,
                    perceivedEffort: 2,
                    unusedMusclePerformance: 1
                  } // Total: 4, SFR = 2
                } // Exercise B
              ],
              [
                {
                  setCount: 5,
                  sorenessScore: 1,
                  performanceScore: 1,
                  rsm: { mindMuscleConnection: 2, pump: 2, disruption: 2 }, // Total: 6
                  fatigue: {
                    jointAndTissueDisruption: 2,
                    perceivedEffort: 2,
                    unusedMusclePerformance: 2
                  } // Total: 6, SFR = 1
                }
              ] // Exercise C
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

      // Exercise A (bench): 4 sets, highest SFR (rsm=9, fatigue=3 -> SFR=3, soreness=0, performance=1 -> +1 recommendation)
      // Exercise B (incline): 5 sets, second SFR (rsm=8, fatigue=4 -> SFR=2, soreness=0, performance=1 -> +1 recommendation)
      // Exercise C (dumbbell): 3 sets, third SFR (rsm=6, fatigue=6 -> SFR=1, soreness=1, performance=0 -> +1 recommendation)
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
                {
                  setCount: 4,
                  sorenessScore: 0,
                  performanceScore: 1,
                  rsm: { mindMuscleConnection: 3, pump: 3, disruption: 3 }, // Total: 9
                  fatigue: {
                    jointAndTissueDisruption: 1,
                    perceivedEffort: 1,
                    unusedMusclePerformance: 1
                  } // Total: 3, SFR = 3
                }, // Exercise A (highest SFR)
                {
                  setCount: 5,
                  sorenessScore: 0,
                  performanceScore: 1,
                  rsm: { mindMuscleConnection: 3, pump: 3, disruption: 2 }, // Total: 8
                  fatigue: {
                    jointAndTissueDisruption: 1,
                    perceivedEffort: 2,
                    unusedMusclePerformance: 1
                  } // Total: 4, SFR = 2
                } // Exercise B (second SFR)
              ],
              [
                {
                  setCount: 3,
                  sorenessScore: 1,
                  performanceScore: 0,
                  rsm: { mindMuscleConnection: 2, pump: 2, disruption: 2 }, // Total: 6
                  fatigue: {
                    jointAndTissueDisruption: 2,
                    perceivedEffort: 2,
                    unusedMusclePerformance: 2
                  } // Total: 6, SFR = 1
                }
              ] // Exercise C (third SFR)
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

    it('should skip recovery exercises and use non-recovery data from previous microcycles', () => {
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
        ],
        microcycleIndex: 2,
        sessionStructure: [[0, 1]],
        historicalMicrocycles: [
          {
            // Microcycle 0: Exercise A has high SFR but triggers recovery due to soreness/performance
            sessionExerciseOverrides: [
              [
                {
                  setCount: 4,
                  sorenessScore: 3,
                  performanceScore: 3, // Triggers recovery (-1 recommendation)
                  rsm: { mindMuscleConnection: 3, pump: 3, disruption: 3 }, // Total: 9
                  fatigue: {
                    jointAndTissueDisruption: 1,
                    perceivedEffort: 1,
                    unusedMusclePerformance: 1
                  } // Total: 3, SFR = 3 (HIGH)
                }, // Exercise A
                {
                  setCount: 3,
                  sorenessScore: 0,
                  performanceScore: 1, // 1 recommendation
                  rsm: { mindMuscleConnection: 2, pump: 2, disruption: 1 }, // Total: 5
                  fatigue: {
                    jointAndTissueDisruption: 2,
                    perceivedEffort: 2,
                    unusedMusclePerformance: 1
                  } // Total: 5, SFR = 1 (LOW)
                } // Exercise B
              ]
            ]
          },
          {
            // Microcycle 1: Exercise A is in recovery with lower sets
            sessionExerciseOverrides: [
              [
                {
                  setCount: 2,
                  sorenessScore: 0,
                  performanceScore: 0,
                  isRecovery: true,
                  rsm: { mindMuscleConnection: 1, pump: 1, disruption: 1 }, // Total: 3
                  fatigue: {
                    jointAndTissueDisruption: 1,
                    perceivedEffort: 1,
                    unusedMusclePerformance: 2
                  } // Total: 4, SFR < 1 (but this should be ignored)
                }, // Exercise A (recovery)
                {
                  setCount: 4,
                  sorenessScore: 0,
                  performanceScore: 1, // 1 recommendation
                  rsm: { mindMuscleConnection: 2, pump: 2, disruption: 1 }, // Total: 5
                  fatigue: {
                    jointAndTissueDisruption: 2,
                    perceivedEffort: 2,
                    unusedMusclePerformance: 1
                  } // Total: 5, SFR = 1
                } // Exercise B
              ]
            ]
          }
        ]
      });

      // Exercise A should use 4 sets from Microcycle 0 (skipping Microcycle 1's recovery data with 2 sets)
      // In Microcycle 2, Exercise A is coming back from recovery, so it's not marked as recovery anymore
      // It should add 1 set because it has a higher SFR, and it is no longer in recovery.
      expect(result.exerciseIdToSetCount.get(chestExercises[0]._id)).toBe(5);
      expect(result.recoveryExerciseIds.has(chestExercises[0]._id)).toBe(false);

      // Exercise B should use 4 sets from Microcycle 1 (most recent) and get 0 additional sets
      expect(result.exerciseIdToSetCount.get(chestExercises[1]._id)).toBe(4);
      expect(result.recoveryExerciseIds.has(chestExercises[1]._id)).toBe(false);
    });

    it('should cut sets in half (rounded down, min 1) when recovery is required', () => {
      const chestExercises: WorkoutExercise[] = [
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
        workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress
      ];

      // Exercise A: 5 sets, triggers recovery (performanceScore=3)
      // Exercise B: 3 sets, does not trigger recovery
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
        sessionStructure: [[0, 1]],
        historicalMicrocycles: [
          {
            sessionExerciseOverrides: [
              [
                {
                  setCount: 5,
                  sorenessScore: 0,
                  performanceScore: 3, // Triggers recovery
                  rsm: { mindMuscleConnection: 2, pump: 2, disruption: 2 },
                  fatigue: {
                    jointAndTissueDisruption: 2,
                    perceivedEffort: 2,
                    unusedMusclePerformance: 2
                  }
                },
                {
                  setCount: 3,
                  sorenessScore: 0,
                  performanceScore: 1, // Normal progression
                  rsm: { mindMuscleConnection: 2, pump: 2, disruption: 2 },
                  fatigue: {
                    jointAndTissueDisruption: 1,
                    perceivedEffort: 1,
                    unusedMusclePerformance: 1
                  }
                }
              ]
            ]
          }
        ]
      });

      // Exercise A should be cut in half: floor(5/2) = 2 sets
      expect(result.exerciseIdToSetCount.get(chestExercises[0]._id)).toBe(2);
      expect(result.recoveryExerciseIds.has(chestExercises[0]._id)).toBe(true);

      // Exercise B should progress normally (3 + 1 = 4 sets based on recommendation)
      expect(result.exerciseIdToSetCount.get(chestExercises[1]._id)).toBe(4);
      expect(result.recoveryExerciseIds.has(chestExercises[1]._id)).toBe(false);
    });

    it('should enforce minimum of 1 set when recovery cuts below 1', () => {
      const chestExercises: WorkoutExercise[] = [
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress
      ];

      // Exercise with only 1 set previously, should remain at 1 when cut in half
      const { result } = calculateSetPlan({
        exercises: chestExercises,
        calibrations: [
          {
            exercise: chestExercises[0],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress
          }
        ],
        microcycleIndex: 1,
        sessionStructure: [[0]],
        historicalMicrocycles: [
          {
            sessionExerciseOverrides: [
              [
                {
                  setCount: 1,
                  sorenessScore: 1,
                  performanceScore: 3, // Triggers recovery
                  rsm: { mindMuscleConnection: 1, pump: 1, disruption: 1 },
                  fatigue: {
                    jointAndTissueDisruption: 3,
                    perceivedEffort: 3,
                    unusedMusclePerformance: 3
                  }
                }
              ]
            ]
          }
        ]
      });

      // Should be minimum 1 set (floor(1/2) = 0, but min is 1)
      expect(result.exerciseIdToSetCount.get(chestExercises[0]._id)).toBe(1);
      expect(result.recoveryExerciseIds.has(chestExercises[0]._id)).toBe(true);
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
            isRecovery?: boolean;
            rsm?: RSM;
            fatigue?: Fatigue;
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

      const result = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(
        context,
        microcycleIndex,
        isDeload
      );

      return { context, result };
    }
  });
});
