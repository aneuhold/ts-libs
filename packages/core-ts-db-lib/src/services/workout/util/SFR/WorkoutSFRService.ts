import type { Fatigue } from '../../../../embedded-types/workout/Fatigue.js';
import type { RSM } from '../../../../embedded-types/workout/Rsm.js';

/**
 * A service for handling Stimulus to Fatigue Ratio (SFR) calculations.
 *
 * This service works with any object that has RSM and Fatigue data.
 */
export default class WorkoutSFRService {
  /**
   * Calculates the total Raw Stimulus Magnitude.
   *
   * @param rsm The RSM data.
   */
  static getRsmTotal(rsm: RSM | null | undefined): number | null {
    if (!rsm || rsm.mindMuscleConnection == null || rsm.pump == null || rsm.disruption == null) {
      return null;
    }
    return rsm.mindMuscleConnection + rsm.pump + rsm.disruption;
  }

  /**
   * Calculates the total fatigue score.
   *
   * @param fatigue The fatigue data.
   */
  static getFatigueTotal(fatigue: Fatigue | null | undefined): number | null {
    if (
      !fatigue ||
      fatigue.jointAndTissueDisruption == null ||
      fatigue.perceivedEffort == null ||
      fatigue.unusedMusclePerformance == null
    ) {
      return null;
    }
    return (
      fatigue.jointAndTissueDisruption + fatigue.perceivedEffort + fatigue.unusedMusclePerformance
    );
  }

  /**
   * Calculates the Stimulus to Fatigue Ratio (SFR).
   *
   * @param rsm The RSM data.
   * @param fatigue The fatigue data.
   */
  static getSFR(rsm: RSM | null | undefined, fatigue: Fatigue | null | undefined): number | null {
    const rsmTotal = this.getRsmTotal(rsm);
    const fatigueTotal = this.getFatigueTotal(fatigue);

    if (rsmTotal === null || fatigueTotal === null) {
      return null;
    }

    if (fatigueTotal === 0) {
      return rsmTotal;
    }

    return rsmTotal / fatigueTotal;
  }
}
