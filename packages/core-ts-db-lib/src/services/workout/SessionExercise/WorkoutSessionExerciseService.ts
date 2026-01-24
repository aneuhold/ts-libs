import type { WorkoutSessionExercise } from '../../../documents/workout/WorkoutSessionExercise.js';
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
}
