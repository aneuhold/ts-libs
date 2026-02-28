/**
 * Severity level for an early deload recommendation.
 *
 * - None: No deload warranted
 * - Suggested: Approaching a threshold, user should be aware
 * - Recommended: Threshold met, deload is the right call
 * - Urgent: Multiple thresholds met, deload strongly advised
 */
export enum WorkoutDeloadSeverity {
  None = 'None',
  Suggested = 'Suggested',
  Recommended = 'Recommended',
  Urgent = 'Urgent'
}

/**
 * Detection rules that can trigger an early deload recommendation.
 */
export enum WorkoutDeloadTriggerRule {
  RecoverySessionThreshold = 'RecoverySessionThreshold',
  ConsecutivePerformanceDrop = 'ConsecutivePerformanceDrop'
}

/**
 * Result of evaluating whether a mesocycle should trigger an early deload.
 */
export type WorkoutDeloadRecommendation = {
  /** Whether a deload is recommended. */
  shouldDeload: boolean;

  /** Severity level of the recommendation. */
  severity: WorkoutDeloadSeverity;

  /** Which detection rules triggered. */
  triggeredRules: WorkoutDeloadTriggerRule[];
};
