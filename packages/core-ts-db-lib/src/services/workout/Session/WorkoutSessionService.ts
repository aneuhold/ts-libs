import type { WorkoutSession } from '../../../documents/workout/WorkoutSession.js';
import WorkoutSFRService from '../util/SFR/WorkoutSFRService.js';

/**
 * A service for handling operations related to {@link WorkoutSession}s.
 */
export default class WorkoutSessionService {
  private static sfrService = new WorkoutSFRService();

  /**
   * Calculates the total Raw Stimulus Magnitude for a session.
   *
   * @param session The workout session.
   */
  static getRsmTotal(session: WorkoutSession): number | null {
    return this.sfrService.getRsmTotal(session.rsm);
  }

  /**
   * Calculates the total fatigue score for a session.
   *
   * @param session The workout session.
   */
  static getFatigueTotal(session: WorkoutSession): number | null {
    return this.sfrService.getFatigueTotal(session.fatigue);
  }

  /**
   * Calculates the Stimulus to Fatigue Ratio (SFR) for a session.
   *
   * @param session The workout session.
   */
  static getSFR(session: WorkoutSession): number | null {
    return this.sfrService.getSFR(session.rsm, session.fatigue);
  }
}
