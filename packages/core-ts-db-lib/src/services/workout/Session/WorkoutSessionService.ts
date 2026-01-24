import type { WorkoutSession } from '../../../documents/workout/WorkoutSession.js';
import WorkoutSFRService from '../util/SFR/WorkoutSFRService.js';

/**
 * A service for handling operations related to {@link WorkoutSession}s.
 */
export default class WorkoutSessionService {
  /**
   * Calculates the total Raw Stimulus Magnitude for a session.
   *
   * @param session The workout session.
   */
  static getRsmTotal(session: WorkoutSession): number | null {
    return WorkoutSFRService.getRsmTotal(session.rsm);
  }

  /**
   * Calculates the total fatigue score for a session.
   *
   * @param session The workout session.
   */
  static getFatigueTotal(session: WorkoutSession): number | null {
    return WorkoutSFRService.getFatigueTotal(session.fatigue);
  }

  /**
   * Calculates the Stimulus to Fatigue Ratio (SFR) for a session.
   *
   * @param session The workout session.
   */
  static getSFR(session: WorkoutSession): number | null {
    return WorkoutSFRService.getSFR(session.rsm, session.fatigue);
  }
}
