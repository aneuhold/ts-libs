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
   * Calculates the performance score (0-3) for an exercise based on its sets.
   *
   * For each set with complete data, a surplus is computed via
   * {@link calculateSetSurplus}. The per-set score is:
   * - 0: surplus >= 2 (exceeded expectations)
   * - 1: surplus 0-1 (on target)
   * - 2: surplus < 0 but hit target reps (declining)
   * - 3: did not hit target reps
   *
   * The exercise score is the rounded average of all per-set scores. Returns
   * `null` if no sets have complete planned and actual data.
   */
  static getPerformanceScore(sets: WorkoutSet[]): number | null {
    const setScores: number[] = [];

    for (const set of sets) {
      if (
        set.plannedReps == null ||
        set.plannedRir == null ||
        set.actualReps == null ||
        set.rir == null
      ) {
        continue;
      }

      if (set.actualReps < set.plannedReps) {
        setScores.push(3);
        continue;
      }

      const surplus = this.calculateSetSurplus(
        set.actualReps,
        set.plannedReps,
        set.rir,
        set.plannedRir
      );

      if (surplus >= 2) {
        setScores.push(0);
      } else if (surplus >= 0) {
        setScores.push(1);
      } else {
        setScores.push(2);
      }
    }

    if (setScores.length === 0) {
      return null;
    }

    const average = setScores.reduce((sum, score) => sum + score, 0) / setScores.length;
    return Math.round(average);
  }

  /**
   * Calculates the surplus for a single set: how much the user exceeded or
   * fell short of the plan. Positive means exceeded, negative means fell short.
   *
   * Formula: `(actualReps - plannedReps) + (rir - plannedRir)`
   *
   * @param actualReps The actual reps performed.
   * @param plannedReps The planned reps.
   * @param rir The actual RIR (reps in reserve).
   * @param plannedRir The planned RIR.
   */
  static calculateSetSurplus(
    actualReps: number,
    plannedReps: number,
    rir: number,
    plannedRir: number
  ): number {
    return actualReps - plannedReps + (rir - plannedRir);
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
   * mindMuscleConnection, pump, unusedMusclePerformance,
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
      sessionExercise.performanceScore != null
    );
  }

  /**
   * Returns true if all session metrics (both mid-session and post-session) are filled out.
   * Post-session metrics are disruption, jointAndTissueDisruption, perceivedEffort,
   * and sorenessScore. Deload exercises are always considered filled.
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
      sessionExercise.fatigue.perceivedEffort != null &&
      sessionExercise.sorenessScore != null
    );
  }
}
