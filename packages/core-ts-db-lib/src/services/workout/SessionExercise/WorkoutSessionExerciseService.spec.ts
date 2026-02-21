import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import WorkoutSessionExerciseService from './WorkoutSessionExerciseService.js';

describe('Unit Tests', () => {
  describe('hasMidSessionMetricsFilled', () => {
    it('should return true for deload exercises regardless of slider values', () => {
      const se = workoutTestUtil.createSessionExercise({
        overrides: { rsm: null, fatigue: null, performanceScore: null }
      });
      const deloadSets = [workoutTestUtil.createSet({ overrides: { plannedRir: null } })];
      expect(WorkoutSessionExerciseService.hasMidSessionMetricsFilled(se, deloadSets)).toBe(true);
    });

    it('should return true when all mid session metrics are filled', () => {
      const se = workoutTestUtil.createSessionExercise({
        overrides: {
          rsm: { mindMuscleConnection: 2, pump: 1, disruption: null },
          fatigue: {
            jointAndTissueDisruption: null,
            perceivedEffort: 2,
            unusedMusclePerformance: 1
          },
          performanceScore: 1
        }
      });
      const sets = [workoutTestUtil.createSet({ overrides: { plannedRir: 2 } })];
      expect(WorkoutSessionExerciseService.hasMidSessionMetricsFilled(se, sets)).toBe(true);
    });

    it('should return false when mindMuscleConnection is null', () => {
      const se = workoutTestUtil.createSessionExercise({
        overrides: {
          rsm: { mindMuscleConnection: null, pump: 1, disruption: null },
          fatigue: {
            jointAndTissueDisruption: null,
            perceivedEffort: 2,
            unusedMusclePerformance: 1
          },
          performanceScore: 1
        }
      });
      const sets = [workoutTestUtil.createSet({ overrides: { plannedRir: 2 } })];
      expect(WorkoutSessionExerciseService.hasMidSessionMetricsFilled(se, sets)).toBe(false);
    });

    it('should return false when rsm is null', () => {
      const se = workoutTestUtil.createSessionExercise({
        overrides: {
          rsm: null,
          fatigue: {
            jointAndTissueDisruption: null,
            perceivedEffort: 2,
            unusedMusclePerformance: 1
          },
          performanceScore: 1
        }
      });
      const sets = [workoutTestUtil.createSet({ overrides: { plannedRir: 2 } })];
      expect(WorkoutSessionExerciseService.hasMidSessionMetricsFilled(se, sets)).toBe(false);
    });

    it('should return false when performanceScore is null', () => {
      const se = workoutTestUtil.createSessionExercise({
        overrides: {
          rsm: { mindMuscleConnection: 2, pump: 1, disruption: null },
          fatigue: {
            jointAndTissueDisruption: null,
            perceivedEffort: 2,
            unusedMusclePerformance: 1
          },
          performanceScore: null
        }
      });
      const sets = [workoutTestUtil.createSet({ overrides: { plannedRir: 2 } })];
      expect(WorkoutSessionExerciseService.hasMidSessionMetricsFilled(se, sets)).toBe(false);
    });

    it('should return false when fatigue is null', () => {
      const se = workoutTestUtil.createSessionExercise({
        overrides: {
          rsm: { mindMuscleConnection: 2, pump: 1, disruption: null },
          fatigue: null,
          performanceScore: 1
        }
      });
      const sets = [workoutTestUtil.createSet({ overrides: { plannedRir: 2 } })];
      expect(WorkoutSessionExerciseService.hasMidSessionMetricsFilled(se, sets)).toBe(false);
    });
  });

  describe('isDeloadExercise', () => {
    it('should return true when all sets have plannedRir == null', () => {
      const sets = [
        workoutTestUtil.createSet({ overrides: { plannedRir: null } }),
        workoutTestUtil.createSet({ overrides: { plannedRir: null } })
      ];
      expect(WorkoutSessionExerciseService.isDeloadExercise(sets)).toBe(true);
    });

    it('should return false when any set has plannedRir set', () => {
      const sets = [
        workoutTestUtil.createSet({ overrides: { plannedRir: null } }),
        workoutTestUtil.createSet({ overrides: { plannedRir: 2 } })
      ];
      expect(WorkoutSessionExerciseService.isDeloadExercise(sets)).toBe(false);
    });

    it('should return false for empty sets array', () => {
      expect(WorkoutSessionExerciseService.isDeloadExercise([])).toBe(false);
    });
  });

  describe('hasAllSessionMetricsFilled', () => {
    it('should return true for deload exercises regardless of metric values', () => {
      const se = workoutTestUtil.createSessionExercise({
        overrides: { rsm: null, fatigue: null, sorenessScore: null }
      });
      const deloadSets = [workoutTestUtil.createSet({ overrides: { plannedRir: null } })];
      expect(WorkoutSessionExerciseService.hasAllSessionMetricsFilled(se, deloadSets)).toBe(true);
    });

    it('should return false when disruption is null', () => {
      const se = workoutTestUtil.createSessionExercise({
        overrides: {
          rsm: { mindMuscleConnection: 2, pump: 2, disruption: null },
          fatigue: {
            jointAndTissueDisruption: 1,
            perceivedEffort: 1,
            unusedMusclePerformance: 1
          },
          performanceScore: 1,
          sorenessScore: 1
        }
      });
      const sets = [workoutTestUtil.createSet({ overrides: { plannedRir: 2 } })];
      expect(WorkoutSessionExerciseService.hasAllSessionMetricsFilled(se, sets)).toBe(false);
    });

    it('should return false when jointAndTissueDisruption is null', () => {
      const se = workoutTestUtil.createSessionExercise({
        overrides: {
          rsm: { mindMuscleConnection: 2, pump: 2, disruption: 2 },
          fatigue: {
            jointAndTissueDisruption: null,
            perceivedEffort: 1,
            unusedMusclePerformance: 1
          },
          performanceScore: 1,
          sorenessScore: 1
        }
      });
      const sets = [workoutTestUtil.createSet({ overrides: { plannedRir: 2 } })];
      expect(WorkoutSessionExerciseService.hasAllSessionMetricsFilled(se, sets)).toBe(false);
    });

    it('should return false when sorenessScore is null', () => {
      const se = workoutTestUtil.createSessionExercise({
        overrides: {
          rsm: { mindMuscleConnection: 2, pump: 2, disruption: 2 },
          fatigue: {
            jointAndTissueDisruption: 1,
            perceivedEffort: 1,
            unusedMusclePerformance: 1
          },
          performanceScore: 1,
          sorenessScore: null
        }
      });
      const sets = [workoutTestUtil.createSet({ overrides: { plannedRir: 2 } })];
      expect(WorkoutSessionExerciseService.hasAllSessionMetricsFilled(se, sets)).toBe(false);
    });

    it('should return false when mid-session metrics are missing', () => {
      const se = workoutTestUtil.createSessionExercise({
        overrides: {
          rsm: { mindMuscleConnection: null, pump: 2, disruption: 2 },
          fatigue: {
            jointAndTissueDisruption: 1,
            perceivedEffort: 1,
            unusedMusclePerformance: 1
          },
          performanceScore: 1,
          sorenessScore: 1
        }
      });
      const sets = [workoutTestUtil.createSet({ overrides: { plannedRir: 2 } })];
      expect(WorkoutSessionExerciseService.hasAllSessionMetricsFilled(se, sets)).toBe(false);
    });

    it('should return true when all metrics are filled', () => {
      const se = workoutTestUtil.createSessionExercise({
        overrides: {
          rsm: { mindMuscleConnection: 2, pump: 2, disruption: 2 },
          fatigue: {
            jointAndTissueDisruption: 1,
            perceivedEffort: 1,
            unusedMusclePerformance: 1
          },
          performanceScore: 1,
          sorenessScore: 1
        }
      });
      const sets = [workoutTestUtil.createSet({ overrides: { plannedRir: 2 } })];
      expect(WorkoutSessionExerciseService.hasAllSessionMetricsFilled(se, sets)).toBe(true);
    });
  });

  describe('getRecommendedSetAdditionsOrRecovery', () => {
    it('should return null when insufficient data is available', () => {
      const workoutSessionExercise = workoutTestUtil.createSessionExercise({
        overrides: {
          sorenessScore: null,
          performanceScore: null
        }
      });

      expect(
        WorkoutSessionExerciseService.getRecommendedSetAdditionsOrRecovery(workoutSessionExercise)
      ).toBeNull();
    });

    it('should return -1 when recovery sessions should be employed', () => {
      const workoutSessionExercise = workoutTestUtil.createSessionExercise({
        overrides: {
          sorenessScore: 0,
          performanceScore: 3
        }
      });

      expect(
        WorkoutSessionExerciseService.getRecommendedSetAdditionsOrRecovery(workoutSessionExercise)
      ).toBe(-1);
    });

    it('should map soreness/performance to representative set additions', () => {
      const cases: Array<{ sorenessScore: number; performanceScore: number; expected: number }> = [
        { sorenessScore: 0, performanceScore: 0, expected: 2 },
        { sorenessScore: 0, performanceScore: 1, expected: 1 },
        { sorenessScore: 1, performanceScore: 0, expected: 1 },
        { sorenessScore: 1, performanceScore: 1, expected: 0 },
        { sorenessScore: 2, performanceScore: 2, expected: 0 },
        { sorenessScore: 3, performanceScore: 2, expected: 0 }
      ];

      for (const testCase of cases) {
        const workoutSessionExercise = workoutTestUtil.createSessionExercise({
          overrides: {
            sorenessScore: testCase.sorenessScore,
            performanceScore: testCase.performanceScore
          }
        });

        expect(
          WorkoutSessionExerciseService.getRecommendedSetAdditionsOrRecovery(workoutSessionExercise)
        ).toBe(testCase.expected);
      }
    });
  });
});
