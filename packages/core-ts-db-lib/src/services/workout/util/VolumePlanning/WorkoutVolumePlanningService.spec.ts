import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../../test-utils/WorkoutTestUtil.js';
import type { WorkoutExerciseCTO } from '../../../../ctos/workout/WorkoutExerciseCTO.js';
import type { WorkoutMuscleGroupVolumeCTO } from '../../../../ctos/workout/WorkoutMuscleGroupVolumeCTO.js';
import type { WorkoutExercise } from '../../../../documents/workout/WorkoutExercise.js';
import { CycleType } from '../../../../documents/workout/WorkoutMesocycle.js';
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
        exerciseCTOs: [
          workoutTestUtil.createExerciseCTO({
            exercise: chestExercises[0],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
            equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
          }),
          workoutTestUtil.createExerciseCTO({
            exercise: chestExercises[1],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress,
            equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
          })
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
        exerciseCTOs: [
          workoutTestUtil.createExerciseCTO({
            exercise: chestExercises[0],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
            equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
          }),
          workoutTestUtil.createExerciseCTO({
            exercise: chestExercises[1],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress,
            equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
          })
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
        exerciseCTOs: [
          workoutTestUtil.createExerciseCTO({
            exercise: chestExercises[0],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
            equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
          }),
          workoutTestUtil.createExerciseCTO({
            exercise: chestExercises[1],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress,
            equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
          }),
          workoutTestUtil.createExerciseCTO({
            exercise: chestExercises[2],
            calibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellChestPress,
            equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell
          })
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

      // Exercises A and B remain at 5 sets (session 0 is at cap: 5+5=10)
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

      const chestCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: chestExercises[0],
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: chestExercises[1],
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: chestExercises[2],
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellChestPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell
        })
      ];

      // Exercise A (bench): 4 sets, highest SFR (rsm=9, fatigue=3 -> SFR=3, soreness=0, performance=1 -> +1 recommendation)
      // Exercise B (incline): 5 sets, second SFR (rsm=8, fatigue=4 -> SFR=2, soreness=0, performance=1 -> +1 recommendation)
      // Exercise C (dumbbell): 3 sets, third SFR (rsm=6, fatigue=6 -> SFR=1, soreness=1, performance=0 -> +1 recommendation)
      // Total sets to add: 3. Session 0 already has 9 sets (4+5), so adding 1 to A caps it at 10.
      // B cannot receive sets due to session cap, so its +1 is redistributed to C.
      const { result } = calculateSetPlan({
        exerciseCTOs: chestCTOs,
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

      const chestCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: chestExercises[0],
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: chestExercises[1],
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const { result } = calculateSetPlan({
        exerciseCTOs: chestCTOs,
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

      const chestCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: chestExercises[0],
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: chestExercises[1],
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      // Exercise A: 5 sets, triggers recovery (performanceScore=3)
      // Exercise B: 3 sets, does not trigger recovery
      const { result } = calculateSetPlan({
        exerciseCTOs: chestCTOs,
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
      const chestCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      // Exercise with only 1 set previously, should remain at 1 when cut in half
      const { result } = calculateSetPlan({
        exerciseCTOs: chestCTOs,
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
      expect(result.exerciseIdToSetCount.get(chestCTOs[0]._id)).toBe(1);
      expect(result.recoveryExerciseIds.has(chestCTOs[0]._id)).toBe(true);
    });

    it('should halve historical set counts during deload and skip SFR-based additions', () => {
      const chestExercises: WorkoutExercise[] = [
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
        workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress
      ];

      const chestCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: chestExercises[0],
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: chestExercises[1],
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      // Exercise A: 6 sets, high SFR that would normally trigger +2 sets
      // Exercise B: 4 sets, moderate SFR that would normally trigger +1 set
      const { result } = calculateSetPlan({
        exerciseCTOs: chestCTOs,
        microcycleIndex: 1,
        isDeload: true,
        sessionStructure: [[0], [1]],
        historicalMicrocycles: [
          {
            sessionExerciseOverrides: [
              [
                {
                  setCount: 6,
                  sorenessScore: 0,
                  performanceScore: 0,
                  rsm: { mindMuscleConnection: 3, pump: 3, disruption: 3 },
                  fatigue: {
                    jointAndTissueDisruption: 1,
                    perceivedEffort: 1,
                    unusedMusclePerformance: 1
                  }
                }
              ],
              [
                {
                  setCount: 4,
                  sorenessScore: 0,
                  performanceScore: 1,
                  rsm: { mindMuscleConnection: 2, pump: 2, disruption: 2 },
                  fatigue: {
                    jointAndTissueDisruption: 1,
                    perceivedEffort: 2,
                    unusedMusclePerformance: 1
                  }
                }
              ]
            ]
          }
        ]
      });

      // Exercise A: floor(6/2) = 3 sets (not 6 or 8)
      expect(result.exerciseIdToSetCount.get(chestExercises[0]._id)).toBe(3);

      // Exercise B: floor(4/2) = 2 sets (not 4 or 5)
      expect(result.exerciseIdToSetCount.get(chestExercises[1]._id)).toBe(2);

      // No recovery exercises during deload
      expect(result.recoveryExerciseIds.size).toBe(0);
    });

    it('should use per-exercise estimatedMav as return set count when exercise comes back from recovery with volume landmarks', () => {
      const chestExercises: WorkoutExercise[] = [
        workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
        workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress
      ];

      const chestCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: chestExercises[0],
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: chestExercises[1],
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      // Volume CTO: MEV=3, MRV=7, MAV=ceil((3+7)/2)=5
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO(
        [{ startingSetCount: 3, peakSetCount: 7, avgRsm: 5, avgPerformanceScore: 2.5 }],
        workoutTestUtil.STANDARD_MUSCLE_GROUPS.chest._id
      );

      const { result } = calculateSetPlan({
        exerciseCTOs: chestCTOs,
        microcycleIndex: 2,
        sessionStructure: [[0, 1]],
        volumeCTOs: [volumeCTO],
        historicalMicrocycles: [
          {
            // Microcycle 0: Exercise A triggers recovery, Exercise B is normal
            sessionExerciseOverrides: [
              [
                {
                  setCount: 6,
                  sorenessScore: 3,
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
                  performanceScore: 1,
                  rsm: { mindMuscleConnection: 2, pump: 2, disruption: 1 },
                  fatigue: {
                    jointAndTissueDisruption: 1,
                    perceivedEffort: 1,
                    unusedMusclePerformance: 1
                  }
                }
              ]
            ]
          },
          {
            // Microcycle 1: Exercise A is in recovery with reduced sets
            sessionExerciseOverrides: [
              [
                {
                  setCount: 3,
                  isRecovery: true,
                  sorenessScore: 0,
                  performanceScore: 0,
                  rsm: { mindMuscleConnection: 1, pump: 1, disruption: 1 },
                  fatigue: {
                    jointAndTissueDisruption: 1,
                    perceivedEffort: 1,
                    unusedMusclePerformance: 1
                  }
                },
                {
                  setCount: 4,
                  sorenessScore: 0,
                  performanceScore: 1,
                  rsm: { mindMuscleConnection: 2, pump: 2, disruption: 1 },
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

      // Exercise A is returning from recovery. With volume landmarks, MAV=5 is distributed
      // across 2 exercises: ceil(5/2) = 3 per exercise.
      expect(result.exerciseIdToSetCount.get(chestExercises[0]._id)).toBe(3);
    });

    it('should start baseline at estimated MEV when volume landmarks have history', () => {
      const chestCTO = workoutTestUtil.createExerciseCTO({
        exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
        calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
        equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
      });

      // Volume CTO with history: MEV=4 (muscle-group total for 1 exercise)
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO(
        [
          { startingSetCount: 4, peakSetCount: 8, avgRsm: 5 },
          { startingSetCount: 4, peakSetCount: 7, avgRsm: 5 }
        ],
        workoutTestUtil.STANDARD_MUSCLE_GROUPS.chest._id
      );

      const { result } = calculateSetPlan({
        exerciseCTOs: [chestCTO],
        microcycleIndex: 0,
        sessionStructure: [[0]],
        volumeCTOs: [volumeCTO]
      });

      // With history, baseline starts at estimated MEV (4) instead of default 2
      expect(result.exerciseIdToSetCount.get(chestCTO._id)).toBe(4);
    });

    it('should use legacy progression from MEV starting point when flag is off', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      // Volume CTO with history: MEV=5 (muscle-group total for 2 exercises)
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO(
        [{ startingSetCount: 5, peakSetCount: 9, avgRsm: 5 }],
        workoutTestUtil.STANDARD_MUSCLE_GROUPS.chest._id
      );

      const mesocycle = workoutTestUtil.createMesocycle({
        plannedSessionCountPerMicrocycle: 1,
        plannedMicrocycleCount: 6,
        calibratedExercises: exerciseCTOs
          .map((cto) => cto.bestCalibration?._id)
          .filter((id): id is NonNullable<typeof id> => id != null)
      });

      const context = workoutTestUtil.createContext({
        mesocycle,
        exerciseCTOs,
        volumeCTOs: [volumeCTO]
      });

      const sessionExerciseCTOs = [[exerciseCTOs[0], exerciseCTOs[1]]];
      context.setPlannedSessionExerciseCTOs(sessionExerciseCTOs);
      context.addMicrocycle(workoutTestUtil.createMicrocycle({ mesocycle }));

      const benchId = workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id;
      const inclineId = workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress._id;

      // MuscleGain, 2 exercises, MEV=5, legacy progression (+1 per microcycle from MEV)
      // mic 0: 5 → distribute(5,2) = [3,2]
      const result0 = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(context, 0, false);
      expect(result0.exerciseIdToSetCount.get(benchId)).toBe(3);
      expect(result0.exerciseIdToSetCount.get(inclineId)).toBe(2);

      // mic 1: 5+1=6 → distribute(6,2) = [3,3]
      const result1 = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(context, 1, false);
      expect(result1.exerciseIdToSetCount.get(benchId)).toBe(3);
      expect(result1.exerciseIdToSetCount.get(inclineId)).toBe(3);

      // mic 2: 5+2=7 → distribute(7,2) = [4,3]
      const result2 = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(context, 2, false);
      expect(result2.exerciseIdToSetCount.get(benchId)).toBe(4);
      expect(result2.exerciseIdToSetCount.get(inclineId)).toBe(3);
    });

    /**
     * Helper to set up context and call calculateSetPlanForMicrocycle
     */
    function calculateSetPlan(options: {
      exerciseCTOs: WorkoutExerciseCTO[];
      microcycleIndex?: number;
      isDeload?: boolean;
      sessionStructure?: number[][];
      volumeCTOs?: WorkoutMuscleGroupVolumeCTO[];
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
        exerciseCTOs,
        microcycleIndex = 0,
        isDeload = false,
        sessionStructure = [[0, 1]],
        volumeCTOs = [],
        historicalMicrocycles = []
      } = options;

      // Create default mesocycle if not provided, with session count matching sessionStructure
      const mesocycle = workoutTestUtil.createMesocycle({
        plannedSessionCountPerMicrocycle: sessionStructure.length,
        calibratedExercises: exerciseCTOs
          .map((cto) => cto.bestCalibration?._id)
          .filter((id): id is NonNullable<typeof id> => id != null)
      });

      const context = workoutTestUtil.createContext({
        mesocycle,
        exerciseCTOs,
        volumeCTOs
      });

      // Build exercise CTO arrays based on session structure
      const sessionExerciseCTOs = sessionStructure.map((sessionExerciseIndices) =>
        sessionExerciseIndices.map((exerciseIndex) => exerciseCTOs[exerciseIndex])
      );

      // Create historical microcycles with performance data
      historicalMicrocycles.forEach((historicalData) => {
        workoutTestUtil.createHistoricalMicrocycle({
          context,
          exerciseCTOs: sessionExerciseCTOs,
          targetRir: 2,
          isDeloadMicrocycle: false,
          sessionExerciseOverrides: historicalData.sessionExerciseOverrides
        });
      });

      // Add the current microcycle being planned
      context.addMicrocycle(workoutTestUtil.createMicrocycle({ mesocycle }));

      context.setPlannedSessionExerciseCTOs(sessionExerciseCTOs);

      const result = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(
        context,
        microcycleIndex,
        isDeload
      );

      return { context, result };
    }
  });

  describe('estimateVolumeLandmarks', () => {
    it('should return defaults when no history exists', () => {
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO([]);
      const result = WorkoutVolumePlanningService.estimateVolumeLandmarks(volumeCTO);

      expect(result.estimatedMev).toBe(2);
      expect(result.estimatedMrv).toBe(8);
      expect(result.estimatedMav).toBe(5);
      expect(result.mesocycleCount).toBe(0);
    });

    it('should return the number of mesocycles used for estimation', () => {
      const volumeCTO1 = workoutTestUtil.createMuscleGroupVolumeCTO([
        { startingSetCount: 3, peakSetCount: 6, avgRsm: 5 }
      ]);
      expect(WorkoutVolumePlanningService.estimateVolumeLandmarks(volumeCTO1).mesocycleCount).toBe(
        1
      );

      const volumeCTO3 = workoutTestUtil.createMuscleGroupVolumeCTO([
        { startingSetCount: 3, peakSetCount: 6, avgRsm: 5 },
        { startingSetCount: 3, peakSetCount: 7, avgRsm: 5 },
        { startingSetCount: 4, peakSetCount: 7, avgRsm: 5 }
      ]);
      expect(WorkoutVolumePlanningService.estimateVolumeLandmarks(volumeCTO3).mesocycleCount).toBe(
        3
      );
    });

    it('should estimate MEV from startingSetCount where avgRsm >= 4', () => {
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO([
        { startingSetCount: 4, peakSetCount: 8, avgRsm: 5 },
        { startingSetCount: 3, peakSetCount: 7, avgRsm: 5 },
        { startingSetCount: 2, peakSetCount: 6, avgRsm: 2 } // Below threshold
      ]);
      const result = WorkoutVolumePlanningService.estimateVolumeLandmarks(volumeCTO);

      // Only mesocycles with avgRsm >= 4: (4 + 3) / 2 = 3.5 -> round = 4
      expect(result.estimatedMev).toBe(4);
    });

    it('should use minimum startingSetCount when no mesocycles have avgRsm >= 4', () => {
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO([
        { startingSetCount: 4, peakSetCount: 8, avgRsm: 2 },
        { startingSetCount: 3, peakSetCount: 7, avgRsm: 1 }
      ]);
      const result = WorkoutVolumePlanningService.estimateVolumeLandmarks(volumeCTO);

      expect(result.estimatedMev).toBe(3);
    });

    it('should estimate MRV from peakSetCount where performance declined or recovery needed', () => {
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO([
        { startingSetCount: 3, peakSetCount: 7, avgRsm: 5, avgPerformanceScore: 2.5 },
        { startingSetCount: 3, peakSetCount: 8, avgRsm: 5, recoverySessionCount: 2 },
        { startingSetCount: 3, peakSetCount: 6, avgRsm: 5, avgPerformanceScore: 1 }
      ]);
      const result = WorkoutVolumePlanningService.estimateVolumeLandmarks(volumeCTO);

      // Stressed mesocycles: peakSetCount 7 and 8 -> average (7+8)/2 = 7.5 -> round = 8
      expect(result.estimatedMrv).toBe(8);
    });

    it('should use highest peakSetCount + 2 when no mesocycle ever hit performance issues', () => {
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO([
        { startingSetCount: 3, peakSetCount: 5, avgRsm: 5, avgPerformanceScore: 1 },
        { startingSetCount: 3, peakSetCount: 6, avgRsm: 5, avgPerformanceScore: 1.5 }
      ]);
      const result = WorkoutVolumePlanningService.estimateVolumeLandmarks(volumeCTO);

      // Highest peakSetCount = 6, + 2 = 8
      expect(result.estimatedMrv).toBe(8);
    });

    it('should not cap MRV at per-session limits since MRV is a per-microcycle total', () => {
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO([
        { startingSetCount: 3, peakSetCount: 9, avgRsm: 5, avgPerformanceScore: 1 }
      ]);
      const result = WorkoutVolumePlanningService.estimateVolumeLandmarks(volumeCTO);

      // 9 + 2 = 11, not capped (MRV spans multiple sessions)
      expect(result.estimatedMrv).toBe(11);
    });

    it('should calculate MAV as midpoint of MEV and MRV', () => {
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO([
        { startingSetCount: 3, peakSetCount: 7, avgRsm: 5, avgPerformanceScore: 2.5 },
        { startingSetCount: 3, peakSetCount: 7, avgRsm: 5, avgPerformanceScore: 2.5 }
      ]);
      const result = WorkoutVolumePlanningService.estimateVolumeLandmarks(volumeCTO);

      // MEV = 3, MRV = 7, MAV = ceil((3+7)/2) = 5
      expect(result.estimatedMav).toBe(5);
    });

    it('should ensure MRV is always greater than MEV', () => {
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO([
        { startingSetCount: 7, peakSetCount: 7, avgRsm: 5, avgPerformanceScore: 3 }
      ]);
      const result = WorkoutVolumePlanningService.estimateVolumeLandmarks(volumeCTO);

      // MEV = 7, MRV from stressed = 7 -> bumped to 8
      expect(result.estimatedMrv).toBeGreaterThan(result.estimatedMev);
    });
  });

  describe('recovery session return logic', () => {
    /**
     * Helper to set up context and call calculateSetPlanForMicrocycle for recovery return tests.
     */
    function calculateRecoveryReturnSetPlan(options: {
      volumeCTOs: WorkoutMuscleGroupVolumeCTO[];
      preRecoverySetCount?: number;
      recoverySetCount?: number;
    }) {
      const { volumeCTOs, preRecoverySetCount = 6, recoverySetCount = 3 } = options;

      const chestExercise = workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress;
      const chestCTO = workoutTestUtil.createExerciseCTO({
        exercise: chestExercise,
        calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
        equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
      });

      const mesocycle = workoutTestUtil.createMesocycle({
        plannedSessionCountPerMicrocycle: 1,
        calibratedExercises: chestCTO.bestCalibration ? [chestCTO.bestCalibration._id] : []
      });

      const context = workoutTestUtil.createContext({
        mesocycle,
        exerciseCTOs: [chestCTO],
        volumeCTOs
      });

      const sessionExerciseCTOs = [[chestCTO]];

      // Microcycle 0: triggers recovery
      workoutTestUtil.createHistoricalMicrocycle({
        context,
        exerciseCTOs: sessionExerciseCTOs,
        sessionExerciseOverrides: [
          [
            {
              setCount: preRecoverySetCount,
              sorenessScore: 3,
              performanceScore: 3,
              rsm: { mindMuscleConnection: 2, pump: 2, disruption: 2 },
              fatigue: {
                jointAndTissueDisruption: 2,
                perceivedEffort: 2,
                unusedMusclePerformance: 2
              }
            }
          ]
        ]
      });

      // Microcycle 1: recovery microcycle with reduced sets
      workoutTestUtil.createHistoricalMicrocycle({
        context,
        exerciseCTOs: sessionExerciseCTOs,
        sessionExerciseOverrides: [
          [
            {
              setCount: recoverySetCount,
              isRecovery: true,
              sorenessScore: 0,
              performanceScore: 0,
              rsm: { mindMuscleConnection: 1, pump: 1, disruption: 1 },
              fatigue: {
                jointAndTissueDisruption: 1,
                perceivedEffort: 1,
                unusedMusclePerformance: 1
              }
            }
          ]
        ]
      });

      // Microcycle 2: returning from recovery
      context.addMicrocycle(workoutTestUtil.createMicrocycle({ mesocycle }));
      context.setPlannedSessionExerciseCTOs(sessionExerciseCTOs);

      const result = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(context, 2, false);

      return { context, result, exerciseId: chestExercise._id };
    }

    it('should return at estimatedMav when recovering with good landmark data (MEV=3, MRV=7)', () => {
      // Volume CTO: avgRsm=5 (effective), avgPerformanceScore=2.5 (stressed)
      // estimatedMev = round(3/1) = 3, estimatedMrv = round(7/1) = 7
      // estimatedMav = ceil((3+7)/2) = 5
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO(
        [{ startingSetCount: 3, peakSetCount: 7, avgRsm: 5, avgPerformanceScore: 2.5 }],
        workoutTestUtil.STANDARD_MUSCLE_GROUPS.chest._id
      );

      const { result, exerciseId } = calculateRecoveryReturnSetPlan({
        volumeCTOs: [volumeCTO]
      });

      expect(result.exerciseIdToSetCount.get(exerciseId)).toBe(5);
      expect(result.recoveryExerciseIds.has(exerciseId)).toBe(false);
    });

    it('should return at estimatedMav when recovering with asymmetric landmarks (MEV=2, MRV=6)', () => {
      // Two mesocycles: one effective (avgRsm=5), one stressed (peakSetCount=6, avgPerformanceScore=3)
      // Effective mesocycles (avgRsm >= 4): only the first with avgRsm=5
      //   estimatedMev = round(2/1) = 2
      // Stressed mesocycles (avgPerformanceScore >= 2.5 or recoverySessionCount > 0): both
      //   estimatedMrv = round((6+6)/2) = 6
      // estimatedMav = ceil((2+6)/2) = 4
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO(
        [
          { startingSetCount: 2, peakSetCount: 6, avgRsm: 5, avgPerformanceScore: 3 },
          { startingSetCount: 3, peakSetCount: 6, avgRsm: 3, avgPerformanceScore: 3 }
        ],
        workoutTestUtil.STANDARD_MUSCLE_GROUPS.chest._id
      );

      // Verify the landmarks first
      const landmarks = WorkoutVolumePlanningService.estimateVolumeLandmarks(volumeCTO);
      expect(landmarks.estimatedMev).toBe(2);
      expect(landmarks.estimatedMrv).toBe(6);
      expect(landmarks.estimatedMav).toBe(4);

      const { result, exerciseId } = calculateRecoveryReturnSetPlan({
        volumeCTOs: [volumeCTO]
      });

      expect(result.exerciseIdToSetCount.get(exerciseId)).toBe(4);
    });

    it('should use default landmarks (MEV=2, MRV=8, MAV=5) when no historical data exists', () => {
      // Empty mesocycle history means Low confidence: defaults are MEV=2, MRV=8
      // estimatedMav = ceil((2+8)/2) = 5
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO(
        [],
        workoutTestUtil.STANDARD_MUSCLE_GROUPS.chest._id
      );

      // Verify the default landmarks
      const landmarks = WorkoutVolumePlanningService.estimateVolumeLandmarks(volumeCTO);
      expect(landmarks.estimatedMev).toBe(2);
      expect(landmarks.estimatedMrv).toBe(8);
      expect(landmarks.estimatedMav).toBe(5);
      expect(landmarks.mesocycleCount).toBe(0);

      const { result, exerciseId } = calculateRecoveryReturnSetPlan({
        volumeCTOs: [volumeCTO]
      });

      expect(result.exerciseIdToSetCount.get(exerciseId)).toBe(5);
    });

    it('should cap recovery return set count at MAX_SETS_PER_EXERCISE (8)', () => {
      // Create landmarks where per-exercise MAV would exceed 8
      // MEV = round((8+8)/2) = 8, MRV = round((10+10)/2) = 10
      // MAV = ceil((8+10)/2) = 9, but 9 > MAX_SETS_PER_EXERCISE (8)
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO(
        [
          { startingSetCount: 8, peakSetCount: 10, avgRsm: 5, avgPerformanceScore: 3 },
          { startingSetCount: 8, peakSetCount: 10, avgRsm: 5, avgPerformanceScore: 3 }
        ],
        workoutTestUtil.STANDARD_MUSCLE_GROUPS.chest._id
      );

      const landmarks = WorkoutVolumePlanningService.estimateVolumeLandmarks(volumeCTO);
      expect(landmarks.estimatedMev).toBe(8);
      expect(landmarks.estimatedMrv).toBe(10);
      expect(landmarks.estimatedMav).toBe(9);

      const { result, exerciseId } = calculateRecoveryReturnSetPlan({
        volumeCTOs: [volumeCTO]
      });

      // MAV is 9, but capped at MAX_SETS_PER_EXERCISE (8)
      expect(result.exerciseIdToSetCount.get(exerciseId)).toBe(8);
    });

    it('should return at estimatedMav that is always between MEV and MRV', () => {
      // Test with various landmark combinations to verify bounds
      const testCases = [
        { startingSetCount: 2, peakSetCount: 4, avgRsm: 5, avgPerformanceScore: 3 },
        { startingSetCount: 5, peakSetCount: 8, avgRsm: 5, avgPerformanceScore: 3 },
        { startingSetCount: 3, peakSetCount: 9, avgRsm: 5, avgPerformanceScore: 3 }
      ];

      for (const testCase of testCases) {
        const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO(
          [testCase],
          workoutTestUtil.STANDARD_MUSCLE_GROUPS.chest._id
        );
        const landmarks = WorkoutVolumePlanningService.estimateVolumeLandmarks(volumeCTO);

        expect(landmarks.estimatedMav).toBeGreaterThanOrEqual(landmarks.estimatedMev);
        expect(landmarks.estimatedMav).toBeLessThanOrEqual(landmarks.estimatedMrv);
      }
    });

    it('should not modify historical set weights when calculating recovery return set count', () => {
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO(
        [{ startingSetCount: 3, peakSetCount: 7, avgRsm: 5, avgPerformanceScore: 2.5 }],
        workoutTestUtil.STANDARD_MUSCLE_GROUPS.chest._id
      );

      const { context, result, exerciseId } = calculateRecoveryReturnSetPlan({
        volumeCTOs: [volumeCTO]
      });

      // Verify set count changed to MAV
      expect(result.exerciseIdToSetCount.get(exerciseId)).toBe(5);

      // Verify historical sets in the context still have their original weights.
      // The pre-recovery microcycle (index 0) and recovery microcycle (index 1) should
      // have their set data intact -- calculateSetPlanForMicrocycle only returns a map,
      // it does not mutate existing sets.
      const historicalSets = context.setsToCreate;
      for (const set of historicalSets) {
        // All historical sets were created with actual weight = planned weight
        expect(set.actualWeight).toBe(set.plannedWeight);
        expect(set.plannedWeight).not.toBeNull();
      }
    });
  });

  describe('cycle-type-specific progression', () => {
    it('should produce flat set counts for Resensitization (no progression)', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = workoutTestUtil.createMesocycle({
        cycleType: CycleType.Resensitization,
        plannedSessionCountPerMicrocycle: 1,
        plannedMicrocycleCount: 4,
        calibratedExercises: exerciseCTOs
          .map((cto) => cto.bestCalibration?._id)
          .filter((id): id is NonNullable<typeof id> => id != null)
      });

      const context = workoutTestUtil.createContext({ mesocycle, exerciseCTOs });
      const sessionExerciseCTOs = [[exerciseCTOs[0]]];
      context.setPlannedSessionExerciseCTOs(sessionExerciseCTOs);

      // Add current microcycle being planned
      context.addMicrocycle(workoutTestUtil.createMicrocycle({ mesocycle }));

      // Test baseline at different microcycle indices
      for (const microcycleIndex of [0, 1, 2, 3]) {
        const result = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(
          context,
          microcycleIndex,
          false
        );
        // Resensitization without history: flat 2 sets per exercise at every microcycle
        expect(
          result.exerciseIdToSetCount.get(workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id)
        ).toBe(2);
      }
    });

    it('should use estimated MEV for Resensitization when volume landmarks have history', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      // Volume CTO with history: MEV=4 (from effective mesocycles with avgRsm >= 4)
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO(
        [
          { startingSetCount: 4, peakSetCount: 7, avgRsm: 5 },
          { startingSetCount: 4, peakSetCount: 8, avgRsm: 5 }
        ],
        workoutTestUtil.STANDARD_MUSCLE_GROUPS.chest._id
      );

      const mesocycle = workoutTestUtil.createMesocycle({
        cycleType: CycleType.Resensitization,
        plannedSessionCountPerMicrocycle: 1,
        plannedMicrocycleCount: 4,
        calibratedExercises: exerciseCTOs
          .map((cto) => cto.bestCalibration?._id)
          .filter((id): id is NonNullable<typeof id> => id != null)
      });

      const context = workoutTestUtil.createContext({
        mesocycle,
        exerciseCTOs,
        volumeCTOs: [volumeCTO]
      });
      context.setPlannedSessionExerciseCTOs([[exerciseCTOs[0]]]);
      context.addMicrocycle(workoutTestUtil.createMicrocycle({ mesocycle }));

      // With history, Resensitization uses estimated MEV (4) instead of default (2)
      for (const microcycleIndex of [0, 1, 2, 3]) {
        const result = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(
          context,
          microcycleIndex,
          false
        );
        expect(
          result.exerciseIdToSetCount.get(workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id)
        ).toBe(4);
      }
    });

    it('should produce half the progression rate for Cut cycles', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = workoutTestUtil.createMesocycle({
        cycleType: CycleType.Cut,
        plannedSessionCountPerMicrocycle: 1,
        calibratedExercises: exerciseCTOs
          .map((cto) => cto.bestCalibration?._id)
          .filter((id): id is NonNullable<typeof id> => id != null)
      });

      const context = workoutTestUtil.createContext({ mesocycle, exerciseCTOs });
      const sessionExerciseCTOs = [[exerciseCTOs[0]]];
      context.setPlannedSessionExerciseCTOs(sessionExerciseCTOs);
      context.addMicrocycle(workoutTestUtil.createMicrocycle({ mesocycle }));

      // Microcycle 0: ceil(0/2) = 0 progression -> 2 sets
      const result0 = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(context, 0, false);
      expect(
        result0.exerciseIdToSetCount.get(workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id)
      ).toBe(2);

      // Microcycle 1: ceil(1/2) = 1 progression -> 3 sets
      const result1 = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(context, 1, false);
      expect(
        result1.exerciseIdToSetCount.get(workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id)
      ).toBe(3);

      // Microcycle 2: ceil(2/2) = 1 progression -> 3 sets
      const result2 = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(context, 2, false);
      expect(
        result2.exerciseIdToSetCount.get(workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id)
      ).toBe(3);

      // Microcycle 3: ceil(3/2) = 2 progression -> 4 sets
      const result3 = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(context, 3, false);
      expect(
        result3.exerciseIdToSetCount.get(workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id)
      ).toBe(4);

      // Microcycle 4: ceil(4/2) = 2 progression -> 4 sets
      const result4 = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(context, 4, false);
      expect(
        result4.exerciseIdToSetCount.get(workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id)
      ).toBe(4);
    });

    it('should maintain normal MuscleGain progression unchanged', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = workoutTestUtil.createMesocycle({
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 1,
        calibratedExercises: exerciseCTOs
          .map((cto) => cto.bestCalibration?._id)
          .filter((id): id is NonNullable<typeof id> => id != null)
      });

      const context = workoutTestUtil.createContext({ mesocycle, exerciseCTOs });
      context.setPlannedSessionExerciseCTOs([[exerciseCTOs[0]]]);
      context.addMicrocycle(workoutTestUtil.createMicrocycle({ mesocycle }));

      // Microcycle 0: 2 sets, Microcycle 1: 3 sets, Microcycle 2: 4 sets
      for (const [index, expectedSets] of [
        [0, 2],
        [1, 3],
        [2, 4],
        [3, 5]
      ]) {
        const result = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(
          context,
          index,
          false
        );
        expect(
          result.exerciseIdToSetCount.get(workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id)
        ).toBe(expectedSets);
      }
    });
  });

  describe('MEV-to-MRV interpolation (USE_VOLUME_LANDMARK_PROGRESSION=true)', () => {
    beforeEach(() => {
      WorkoutVolumePlanningService.USE_VOLUME_LANDMARK_PROGRESSION = true;
    });

    afterEach(() => {
      WorkoutVolumePlanningService.USE_VOLUME_LANDMARK_PROGRESSION = false;
    });

    it('should interpolate from startVolume to endVolume across accumulation microcycles (1 exercise, no history)', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      // 5 accumulation + 1 deload = 6 total
      const mesocycle = workoutTestUtil.createMesocycle({
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 1,
        plannedMicrocycleCount: 6,
        calibratedExercises: exerciseCTOs
          .map((cto) => cto.bestCalibration?._id)
          .filter((id): id is NonNullable<typeof id> => id != null)
      });

      const context = workoutTestUtil.createContext({ mesocycle, exerciseCTOs });
      context.setPlannedSessionExerciseCTOs([[exerciseCTOs[0]]]);
      context.addMicrocycle(workoutTestUtil.createMicrocycle({ mesocycle }));

      const benchId = workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id;

      // No history: startVolume=2, endVolume=8 (1 exercise)
      // round(2 + 6*i/4): mic 0=2, mic 1=4, mic 2=5, mic 3=7, mic 4=8
      const expected = [2, 4, 5, 7, 8];
      for (let i = 0; i < expected.length; i++) {
        const result = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(
          context,
          i,
          false
        );
        expect(result.exerciseIdToSetCount.get(benchId)).toBe(expected[i]);
      }
    });

    it('should halve last accumulation counts for deload', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = workoutTestUtil.createMesocycle({
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 1,
        plannedMicrocycleCount: 6,
        calibratedExercises: exerciseCTOs
          .map((cto) => cto.bestCalibration?._id)
          .filter((id): id is NonNullable<typeof id> => id != null)
      });

      const context = workoutTestUtil.createContext({ mesocycle, exerciseCTOs });
      context.setPlannedSessionExerciseCTOs([[exerciseCTOs[0]]]);
      context.addMicrocycle(workoutTestUtil.createMicrocycle({ mesocycle }));

      const benchId = workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id;

      // Last accumulation microcycle (index 4) has 8 sets, deload = floor(8/2) = 4
      const result = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(context, 5, true);
      expect(result.exerciseIdToSetCount.get(benchId)).toBe(4);
    });

    it('should interpolate with MEV and MRV from volume landmarks', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      // Volume CTO with history: MEV=5, MRV=9
      const volumeCTO = workoutTestUtil.createMuscleGroupVolumeCTO(
        [{ startingSetCount: 5, peakSetCount: 9, avgRsm: 5, avgPerformanceScore: 2.5 }],
        workoutTestUtil.STANDARD_MUSCLE_GROUPS.chest._id
      );

      // 5 accumulation + 1 deload = 6 total
      const mesocycle = workoutTestUtil.createMesocycle({
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 1,
        plannedMicrocycleCount: 6,
        calibratedExercises: exerciseCTOs
          .map((cto) => cto.bestCalibration?._id)
          .filter((id): id is NonNullable<typeof id> => id != null)
      });

      const context = workoutTestUtil.createContext({
        mesocycle,
        exerciseCTOs,
        volumeCTOs: [volumeCTO]
      });
      context.setPlannedSessionExerciseCTOs([[exerciseCTOs[0], exerciseCTOs[1]]]);
      context.addMicrocycle(workoutTestUtil.createMicrocycle({ mesocycle }));

      const benchId = workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id;
      const inclineId = workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress._id;

      // MEV=5, MRV=9, 5 accumulation microcycles, 2 exercises
      // round(5 + 4*i/4) = round(5+i): mic 0=5, mic 1=6, mic 2=7, mic 3=8, mic 4=9
      // distribute(5,2)=[3,2], distribute(6,2)=[3,3], distribute(7,2)=[4,3],
      // distribute(8,2)=[4,4], distribute(9,2)=[5,4]
      const expectedBench = [3, 3, 4, 4, 5];
      const expectedIncline = [2, 3, 3, 4, 4];
      for (let i = 0; i < expectedBench.length; i++) {
        const result = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(
          context,
          i,
          false
        );
        expect(result.exerciseIdToSetCount.get(benchId)).toBe(expectedBench[i]);
        expect(result.exerciseIdToSetCount.get(inclineId)).toBe(expectedIncline[i]);
      }
    });

    it('should target MAV for Cut cycles instead of MRV', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      // 5 accumulation + 1 deload = 6 total
      const mesocycle = workoutTestUtil.createMesocycle({
        cycleType: CycleType.Cut,
        plannedSessionCountPerMicrocycle: 1,
        plannedMicrocycleCount: 6,
        calibratedExercises: exerciseCTOs
          .map((cto) => cto.bestCalibration?._id)
          .filter((id): id is NonNullable<typeof id> => id != null)
      });

      const context = workoutTestUtil.createContext({ mesocycle, exerciseCTOs });
      context.setPlannedSessionExerciseCTOs([[exerciseCTOs[0]]]);
      context.addMicrocycle(workoutTestUtil.createMicrocycle({ mesocycle }));

      const benchId = workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id;

      // No history, Cut: startVolume=2, endVolume=ceil((2+8)/2)=5 (MAV of defaults)
      // round(2 + 3*i/4): mic 0=2, mic 1=3, mic 2=4, mic 3=4, mic 4=5
      const expected = [2, 3, 4, 4, 5];
      for (let i = 0; i < expected.length; i++) {
        const result = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(
          context,
          i,
          false
        );
        expect(result.exerciseIdToSetCount.get(benchId)).toBe(expected[i]);
      }
    });

    it('should keep Resensitization flat regardless of flag', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        }),
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.inclineBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      const mesocycle = workoutTestUtil.createMesocycle({
        cycleType: CycleType.Resensitization,
        plannedSessionCountPerMicrocycle: 1,
        plannedMicrocycleCount: 4,
        calibratedExercises: exerciseCTOs
          .map((cto) => cto.bestCalibration?._id)
          .filter((id): id is NonNullable<typeof id> => id != null)
      });

      const context = workoutTestUtil.createContext({ mesocycle, exerciseCTOs });
      context.setPlannedSessionExerciseCTOs([[exerciseCTOs[0], exerciseCTOs[1]]]);
      context.addMicrocycle(workoutTestUtil.createMicrocycle({ mesocycle }));

      const benchId = workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id;
      const inclineId = workoutTestUtil.STANDARD_EXERCISES.inclineBenchPress._id;

      // Resensitization: flat at 2 per exercise regardless of flag
      for (const microcycleIndex of [0, 1, 2, 3]) {
        const result = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(
          context,
          microcycleIndex,
          false
        );
        expect(result.exerciseIdToSetCount.get(benchId)).toBe(2);
        expect(result.exerciseIdToSetCount.get(inclineId)).toBe(2);
      }
    });

    it('should handle single accumulation microcycle gracefully', () => {
      const exerciseCTOs = [
        workoutTestUtil.createExerciseCTO({
          exercise: workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress,
          calibration: workoutTestUtil.STANDARD_CALIBRATIONS.barbellBenchPress,
          equipmentType: workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell
        })
      ];

      // 1 accumulation + 1 deload = 2 total
      const mesocycle = workoutTestUtil.createMesocycle({
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 1,
        plannedMicrocycleCount: 2,
        calibratedExercises: exerciseCTOs
          .map((cto) => cto.bestCalibration?._id)
          .filter((id): id is NonNullable<typeof id> => id != null)
      });

      const context = workoutTestUtil.createContext({ mesocycle, exerciseCTOs });
      context.setPlannedSessionExerciseCTOs([[exerciseCTOs[0]]]);
      context.addMicrocycle(workoutTestUtil.createMicrocycle({ mesocycle }));

      const benchId = workoutTestUtil.STANDARD_EXERCISES.barbellBenchPress._id;

      // accumulationMicrocycleCount = 1, so should use startVolume
      const result = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(context, 0, false);
      expect(result.exerciseIdToSetCount.get(benchId)).toBe(2);
    });
  });
});
