import type { WorkoutSessionExercise } from '../../../documents/workout/WorkoutSessionExercise.js';
import type { WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import WorkoutSFRService from '../util/SFR/WorkoutSFRService.js';

/**
 * A service for handling operations related to {@link WorkoutSessionExercise}s.
 */
export default class WorkoutSessionExerciseService {
  /**
   * Calculates the total Raw Stimulus Magnitude for a specific exercise within a session.
   *
   * @param sessionExercise The workout session exercise.
   */
  static getRsmTotal(sessionExercise: WorkoutSessionExercise): number | null {
    return WorkoutSFRService.getRsmTotal(sessionExercise.rsm);
  }

  /**
   * Calculates the total fatigue score for a specific exercise within a session.
   *
   * @param sessionExercise The workout session exercise.
   */
  static getFatigueTotal(sessionExercise: WorkoutSessionExercise): number | null {
    return WorkoutSFRService.getFatigueTotal(sessionExercise.fatigue);
  }

  /**
   * Calculates the Stimulus to Fatigue Ratio (SFR) for a specific exercise.
   *
   * @param sessionExercise The workout session exercise.
   */
  static getSFR(sessionExercise: WorkoutSessionExercise): number | null {
    return WorkoutSFRService.getSFR(sessionExercise.rsm, sessionExercise.fatigue);
  }

  /**
   * Uses the soreness/performance table from the workout model notes to recommend whether to add
   * sets next microcycle or employ recovery sessions.
   *
   * Interpretation:
   * - Returns `-1` when recovery sessions should be employed.
   * - Returns `0` when no sets should be added.
   * - Returns a non-negative integer when sets should be added.
   * - Returns `null` when insufficient data is available.
   * 
   * The table is:
   * 
   * | Soreness Score ↓ \ Performance Score → | 0 | 1 | 2 | 3 |
     |---|---|---|---|---|
     | **0** | Add 1–3 sets | Add 0–2 sets | Do not add sets | Employ recovery sessions (see Fatigue Management) |
     | **1** | Add 1–2 sets | Add 0–1 sets | Do not add sets | Employ recovery sessions (see Fatigue Management) |
     | **2** | Do not add sets | Do not add sets | Do not add sets | Employ recovery sessions (see Fatigue Management) |
     | **3** | Do not add sets | Do not add sets | Do not add sets | Employ recovery sessions (see Fatigue Management) |
   */
  static getRecommendedSetAdditionsOrRecovery(
    workoutSessionExercise: WorkoutSessionExercise
  ): number | null {
    const { performanceScore, sorenessScore } = workoutSessionExercise;
    if (sorenessScore == null || performanceScore == null) {
      return null;
    }

    // Table mapping (sorenessScore rows, performanceScore columns).
    // Values are representative set additions (midpoint of table ranges), or -1 for recovery.
    const table: number[][] = [
      // Soreness 0: [Add 1-3, Add 0-2, Do not add, Recovery]
      [2, 1, 0, -1],
      // Soreness 1: [Add 1-2, Add 0-1, Do not add, Recovery]
      [1, 0, 0, -1],
      // Soreness 2: [Do not add, Do not add, Do not add, Recovery]
      [0, 0, 0, -1],
      // Soreness 3: [Do not add, Do not add, Do not add, Recovery]
      [0, 0, 0, -1]
    ];

    return table[sorenessScore]?.[performanceScore] ?? null;
  }

  /**
   * Returns true if the exercise is a deload exercise (all sets have plannedRir == null).
   */
  static isDeloadExercise(exerciseSets: WorkoutSet[]): boolean {
    return exerciseSets.length > 0 && exerciseSets.every((s) => s.plannedRir == null);
  }

  /**
   * Returns true if all mid-session metrics are filled out for the session exercise.
   * Mid-session metrics are filled out right after performing the exercise:
   * mindMuscleConnection, pump, unusedMusclePerformance, perceivedEffort,
   * and performanceScore. Deload exercises are always considered filled.
   */
  static hasMidSessionMetricsFilled(
    sessionExercise: WorkoutSessionExercise,
    exerciseSets: WorkoutSet[]
  ): boolean {
    if (WorkoutSessionExerciseService.isDeloadExercise(exerciseSets)) return true;
    return (
      sessionExercise.rsm?.mindMuscleConnection != null &&
      sessionExercise.rsm.pump != null &&
      sessionExercise.fatigue?.unusedMusclePerformance != null &&
      sessionExercise.fatigue.perceivedEffort != null &&
      sessionExercise.performanceScore != null
    );
  }

  /**
   * Returns true if all session metrics (both mid-session and post-session) are filled out.
   * Post-session metrics are disruption, jointAndTissueDisruption, and sorenessScore.
   * Deload exercises are always considered filled.
   */
  static hasAllSessionMetricsFilled(
    sessionExercise: WorkoutSessionExercise,
    exerciseSets: WorkoutSet[]
  ): boolean {
    if (!WorkoutSessionExerciseService.hasMidSessionMetricsFilled(sessionExercise, exerciseSets)) {
      return false;
    }
    if (WorkoutSessionExerciseService.isDeloadExercise(exerciseSets)) return true;
    return (
      sessionExercise.rsm?.disruption != null &&
      sessionExercise.fatigue?.jointAndTissueDisruption != null &&
      sessionExercise.sorenessScore != null
    );
  }
}
