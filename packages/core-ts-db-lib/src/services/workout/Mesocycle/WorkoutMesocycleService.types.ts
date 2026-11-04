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
 * Why a session in a mesocycle cannot be logged yet. Stated here because it has
 * more to do with the state of the mesocycle than the session alone for the most part.
 */
export enum WorkoutSessionLockReason {
  /** The mesocycle has not been started. */
  MesocycleNotStarted = 'MesocycleNotStarted',
  /** The session belongs to a microcycle after the current microcycle. */
  PreviousMicrocycleNotCompleted = 'PreviousMicrocycleNotCompleted',
  /** The session before it in the same microcycle is not complete. */
  PreviousSessionNotCompleted = 'PreviousSessionNotCompleted'
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
