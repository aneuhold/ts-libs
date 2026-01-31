import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import WorkoutSessionExerciseService from './WorkoutSessionExerciseService.js';

describe('Unit Tests', () => {
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
