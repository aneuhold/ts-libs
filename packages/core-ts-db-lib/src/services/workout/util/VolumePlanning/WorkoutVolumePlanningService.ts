import type { UUID } from 'crypto';
import type { WorkoutExerciseCTO } from '../../../../ctos/workout/WorkoutExerciseCTO.js';
import type {
  WorkoutMuscleGroupVolumeCTO,
  WorkoutVolumeLandmarkEstimate
} from '../../../../ctos/workout/WorkoutMuscleGroupVolumeCTO.js';
import type { WorkoutSessionExercise } from '../../../../documents/workout/WorkoutSessionExercise.js';
import type WorkoutMesocyclePlanContext from '../../Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutSessionExerciseService from '../../SessionExercise/WorkoutSessionExerciseService.js';
import WorkoutSFRService from '../SFR/WorkoutSFRService.js';

/**
 * A service for handling volume planning operations across microcycles.
 *
 * SCOPE: Microcycle-level volume distribution (calculating set counts per exercise)
 *
 * RESPONSIBILITIES:
 * - Calculate set counts for exercises across a microcycle
 * - Apply progressive overload rules (baseline + historical adjustments)
 * - Handle recovery exercise identification
 * - Enforce volume limits (per exercise, per muscle group per session)
 *
 * RELATED SERVICES:
 * - {@link WorkoutMicrocycleService} - Calls this to get set plans before generating sessions
 * - {@link WorkoutSessionService} - Uses the output to generate actual sessions
 * - {@link WorkoutSessionExerciseService} - Used to calculate SFR and recovery recommendations
 */
export default class WorkoutVolumePlanningService {
  private static readonly MAX_SETS_PER_EXERCISE = 8;
  private static readonly MAX_SETS_PER_MUSCLE_GROUP_PER_SESSION = 10;

  /** Minimum average RSM required for a mesocycle to count toward MEV estimation. */
  private static readonly MEV_RSM_THRESHOLD = 4;

  /** Default estimated MEV when no qualifying mesocycle history exists. */
  private static readonly DEFAULT_MEV = 2;

  /** Minimum average performance score (or recovery presence) to count a mesocycle toward MRV estimation. */
  private static readonly MRV_PERFORMANCE_THRESHOLD = 2.5;

  /** Extra sets added above the historical peak when no stressed mesocycles exist, to estimate MRV. */
  private static readonly MRV_HEADROOM = 2;

  /** Default estimated MRV when no mesocycle history exists at all. */
  private static readonly DEFAULT_MRV = 8;

  /** RSM bracket upper bound for "below MEV" proximity (0 to this value inclusive). */
  private static readonly MEV_PROXIMITY_BELOW_THRESHOLD = 3;

  /** RSM bracket upper bound for "at MEV" proximity (above BELOW threshold up to this value inclusive). */
  private static readonly MEV_PROXIMITY_AT_THRESHOLD = 6;

  /** Recommended set adjustment when volume is below MEV. */
  private static readonly MEV_BELOW_SET_ADJUSTMENT = 3;

  /** Recommended set adjustment when volume is above MEV. */
  private static readonly MEV_ABOVE_SET_ADJUSTMENT = -2;

  /** Maximum sets that can be added to a single exercise in one progression step. */
  private static readonly MAX_SET_ADDITION_PER_EXERCISE = 2;

  /** Maximum total sets to distribute across a muscle group in one progression step. */
  private static readonly MAX_TOTAL_SET_ADDITIONS = 3;

  /**
   * Calculates the set plan for an entire microcycle.
   */
  static calculateSetPlanForMicrocycle(
    context: WorkoutMesocyclePlanContext,
    microcycleIndex: number,
    isDeloadMicrocycle: boolean
  ): { exerciseIdToSetCount: Map<UUID, number>; recoveryExerciseIds: Set<UUID> } {
    if (!context.muscleGroupToExerciseCTOsMap) {
      throw new Error(
        'WorkoutMesocyclePlanContext.muscleGroupToExerciseCTOsMap is not initialized. This should be set during mesocycle planning.'
      );
    }

    const exerciseIdToSetCount = new Map<UUID, number>();
    const recoveryExerciseIds = new Set<UUID>();

    context.muscleGroupToExerciseCTOsMap.values().forEach((muscleGroupExerciseCTOs) => {
      const result = this.calculateSetCountForEachExerciseInMuscleGroup(
        context,
        microcycleIndex,
        muscleGroupExerciseCTOs,
        isDeloadMicrocycle
      );
      for (const [workoutExerciseId, setCount] of result.exerciseIdToSetCount) {
        exerciseIdToSetCount.set(workoutExerciseId, setCount);
      }
      for (const recoveryExerciseId of result.recoveryExerciseIds) {
        recoveryExerciseIds.add(recoveryExerciseId);
      }
    });

    // Apply MEV proximity adjustment when generating the second microcycle (index 1)
    // after the first microcycle is complete with RSM data. Only applies when volume
    // data (volumeCTOs) was provided to the context.
    if (
      microcycleIndex === 1 &&
      !isDeloadMicrocycle &&
      context.muscleGroupToVolumeLandmarkMap.size > 0
    ) {
      this.applyMevProximityAdjustments(context, exerciseIdToSetCount);
    }

    return { exerciseIdToSetCount, recoveryExerciseIds };
  }

  /**
   * Estimates MEV, MRV, and MAV for a muscle group based on historical data
   * across completed mesocycles.
   *
   * @param volumeCTO The WorkoutMuscleGroupVolumeCTO containing mesocycle
   *   history for this muscle group.
   */
  static estimateVolumeLandmarks(
    volumeCTO: WorkoutMuscleGroupVolumeCTO
  ): WorkoutVolumeLandmarkEstimate {
    const { mesocycleHistory } = volumeCTO;

    // Estimated MEV
    let estimatedMev: number;
    const effectiveMesocycles = mesocycleHistory.filter(
      (m) => m.avgRsm !== null && m.avgRsm >= this.MEV_RSM_THRESHOLD
    );
    if (effectiveMesocycles.length > 0) {
      estimatedMev =
        effectiveMesocycles.reduce((sum, m) => sum + m.startingSetCount, 0) /
        effectiveMesocycles.length;
      estimatedMev = Math.round(estimatedMev);
    } else if (mesocycleHistory.length > 0) {
      estimatedMev = Math.min(...mesocycleHistory.map((m) => m.startingSetCount));
    } else {
      estimatedMev = this.DEFAULT_MEV;
    }

    // Estimated MRV
    let estimatedMrv: number;
    const stressedMesocycles = mesocycleHistory.filter(
      (m) =>
        (m.avgPerformanceScore !== null &&
          m.avgPerformanceScore >= this.MRV_PERFORMANCE_THRESHOLD) ||
        m.recoverySessionCount > 0
    );
    if (stressedMesocycles.length > 0) {
      estimatedMrv =
        stressedMesocycles.reduce((sum, m) => sum + m.peakSetCount, 0) / stressedMesocycles.length;
      estimatedMrv = Math.round(estimatedMrv);
    } else if (mesocycleHistory.length > 0) {
      estimatedMrv = Math.max(...mesocycleHistory.map((m) => m.peakSetCount)) + this.MRV_HEADROOM;
    } else {
      estimatedMrv = this.DEFAULT_MRV;
    }

    // Hard cap MRV at 10 (MAX_SETS_PER_MUSCLE_GROUP_PER_SESSION)
    estimatedMrv = Math.min(estimatedMrv, this.MAX_SETS_PER_MUSCLE_GROUP_PER_SESSION);

    // Ensure MRV > MEV
    if (estimatedMrv <= estimatedMev) {
      estimatedMrv = estimatedMev + 1;
    }

    const estimatedMav = Math.ceil((estimatedMev + estimatedMrv) / 2);

    return { estimatedMev, estimatedMrv, estimatedMav, mesocycleCount: mesocycleHistory.length };
  }

  /**
   * Evaluates MEV (Minimum Effective Volume) proximity for a muscle group based on
   * RSM scores from the first microcycle. Called when generating the second microcycle to adjust
   * the volume baseline.
   *
   * Returns `null` when the first microcycle is incomplete or has no RSM data for the muscle group.
   *
   * @param context The mesocycle planning context containing microcycle/session/exercise data.
   * @param muscleGroupId The muscle group to evaluate.
   */
  static evaluateMevProximity(
    context: WorkoutMesocyclePlanContext,
    muscleGroupId: UUID
  ): {
    /** 'below' = RSM 0-3, 'at' = RSM 4-6, 'above' = RSM 7-9 */
    proximity: 'below' | 'at' | 'above';

    /**
     * Recommended total set adjustment for this muscle group.
     * Positive = add sets, negative = remove sets, 0 = no change.
     * Range: -2 to +3
     */
    recommendedSetAdjustment: number;

    /** The average RSM across session exercises targeting this muscle group. */
    averageRsm: number;
  } | null {
    const firstMicrocycle = context.microcyclesInOrder[0];
    if (!firstMicrocycle) return null;

    // Check the first microcycle is complete
    const lastSessionId = firstMicrocycle.sessionOrder[firstMicrocycle.sessionOrder.length - 1];
    if (!context.sessionMap.get(lastSessionId)?.complete) return null;

    // Collect RSM totals from session exercises that target this muscle group
    const rsmTotals: number[] = [];
    for (const sessionId of firstMicrocycle.sessionOrder) {
      const session = context.sessionMap.get(sessionId);
      if (!session) continue;
      for (const seId of session.sessionExerciseOrder) {
        const se = context.sessionExerciseMap.get(seId);
        if (!se) continue;
        const exercise = context.exerciseMap.get(se.workoutExerciseId);
        if (!exercise?.primaryMuscleGroups.includes(muscleGroupId)) continue;

        const rsmTotal = WorkoutSFRService.getRsmTotal(se.rsm);
        if (rsmTotal !== null) {
          rsmTotals.push(rsmTotal);
        }
      }
    }

    if (rsmTotals.length === 0) return null;

    const averageRsm = rsmTotals.reduce((sum, val) => sum + val, 0) / rsmTotals.length;
    const bracket = Math.floor(averageRsm);

    if (bracket <= this.MEV_PROXIMITY_BELOW_THRESHOLD) {
      return {
        proximity: 'below',
        recommendedSetAdjustment: this.MEV_BELOW_SET_ADJUSTMENT,
        averageRsm
      };
    } else if (bracket <= this.MEV_PROXIMITY_AT_THRESHOLD) {
      return { proximity: 'at', recommendedSetAdjustment: 0, averageRsm };
    }
    return {
      proximity: 'above',
      recommendedSetAdjustment: this.MEV_ABOVE_SET_ADJUSTMENT,
      averageRsm
    };
  }

  /**
   * Applies MEV proximity adjustments based on RSM data from the first microcycle.
   * Adjusts set counts per muscle group when the first microcycle indicates volume
   * was below or above MEV.
   */
  private static applyMevProximityAdjustments(
    context: WorkoutMesocyclePlanContext,
    exerciseIdToSetCount: Map<UUID, number>
  ): void {
    if (!context.muscleGroupToExerciseCTOsMap) return;

    for (const [muscleGroupId, muscleGroupExerciseCTOs] of context.muscleGroupToExerciseCTOsMap) {
      const mevResult = this.evaluateMevProximity(context, muscleGroupId);
      if (!mevResult || mevResult.recommendedSetAdjustment === 0) continue;

      // Distribute the adjustment evenly across exercises in this muscle group
      const exerciseCount = muscleGroupExerciseCTOs.length;
      const adjustmentPerExercise = Math.floor(mevResult.recommendedSetAdjustment / exerciseCount);
      const adjustmentRemainder = mevResult.recommendedSetAdjustment % exerciseCount;

      muscleGroupExerciseCTOs.forEach((cto, index) => {
        const currentSets = exerciseIdToSetCount.get(cto._id) ?? 2;
        const extra =
          index < Math.abs(adjustmentRemainder) ? Math.sign(mevResult.recommendedSetAdjustment) : 0;
        const newSets = Math.max(
          1,
          Math.min(currentSets + adjustmentPerExercise + extra, this.MAX_SETS_PER_EXERCISE)
        );
        exerciseIdToSetCount.set(cto._id, newSets);
      });
    }
  }

  /**
   * Calculates the set count for each exercise in a particular muscle group for this microcycle.
   *
   * If there is no previous microcycle data for the muscle group, this falls back to
   * the baseline progression rules.
   */
  private static calculateSetCountForEachExerciseInMuscleGroup(
    context: WorkoutMesocyclePlanContext,
    microcycleIndex: number,
    muscleGroupExerciseCTOs: WorkoutExerciseCTO[],
    isDeloadMicrocycle: boolean
  ): { exerciseIdToSetCount: Map<UUID, number>; recoveryExerciseIds: Set<UUID> } {
    const exerciseIdToSetCount = new Map<UUID, number>();
    const recoveryExerciseIds = new Set<UUID>();
    const sessionIndexToExerciseIds = new Map<number, UUID[]>();

    const { progressionInterval } = context;

    // 1. Calculate baselines for all exercises in muscle group
    muscleGroupExerciseCTOs.forEach((cto, index) => {
      const baseline = this.calculateBaselineSetCount(
        microcycleIndex,
        muscleGroupExerciseCTOs.length,
        index,
        isDeloadMicrocycle,
        progressionInterval
      );
      exerciseIdToSetCount.set(cto._id, Math.min(baseline, this.MAX_SETS_PER_EXERCISE));

      // Build out the map for session indices to the array of exercise IDs as it pertains to this
      // muscle group.
      if (!context.exerciseIdToSessionIndex) return;
      const exerciseSessionIndex = context.exerciseIdToSessionIndex.get(cto._id);
      if (exerciseSessionIndex === undefined) return;
      const existingExerciseIdsForSession =
        sessionIndexToExerciseIds.get(exerciseSessionIndex) || [];
      existingExerciseIdsForSession.push(cto._id);
      sessionIndexToExerciseIds.set(exerciseSessionIndex, existingExerciseIdsForSession);
    });

    // 2. Resolve historical performance data
    // Return if no previous microcycle
    let previousMicrocycleIndex = microcycleIndex - 1;
    let previousMicrocycle = context.microcyclesInOrder[previousMicrocycleIndex];
    if (!previousMicrocycle) return { exerciseIdToSetCount, recoveryExerciseIds };

    // Map previous session exercises
    const exerciseIds = new Set(muscleGroupExerciseCTOs.map((cto) => cto._id));
    const exerciseIdToPrevSessionExercise = new Map<UUID, WorkoutSessionExercise>();
    const foundExerciseIds = new Set<UUID>();
    const exercisesThatWerePreviouslyInRecovery = new Set<UUID>();
    // Loop through each previous microcycle until we find all exercises or run out of microcycles
    while (exerciseIdToPrevSessionExercise.size < exerciseIds.size && previousMicrocycle) {
      // Check if the previous microcycle is complete; if not, we cannot use its data
      const lastSessionId =
        previousMicrocycle.sessionOrder[previousMicrocycle.sessionOrder.length - 1];
      const microcycleIsComplete = context.sessionMap.get(lastSessionId)?.complete;
      if (!microcycleIsComplete) {
        break;
      }

      // Start with session order
      for (const sessionId of previousMicrocycle.sessionOrder) {
        const session = context.sessionMap.get(sessionId);
        if (!session) continue;
        // Get the session exercises for this session
        for (const sessionExerciseId of session.sessionExerciseOrder) {
          const sessionExercise = context.sessionExerciseMap.get(sessionExerciseId);
          // Map if in our muscle group && it isn't a recovery exercise
          if (
            sessionExercise &&
            exerciseIds.has(sessionExercise.workoutExerciseId) &&
            !foundExerciseIds.has(sessionExercise.workoutExerciseId) &&
            !sessionExercise.isRecoveryExercise
          ) {
            exerciseIdToPrevSessionExercise.set(sessionExercise.workoutExerciseId, sessionExercise);
            foundExerciseIds.add(sessionExercise.workoutExerciseId);
            if (previousMicrocycleIndex < microcycleIndex - 1) {
              exercisesThatWerePreviouslyInRecovery.add(sessionExercise.workoutExerciseId);
            }
          }
        }
      }
      // Move to earlier microcycle
      previousMicrocycleIndex = previousMicrocycleIndex - 1;
      previousMicrocycle = context.microcyclesInOrder[previousMicrocycleIndex];
    }
    if (exerciseIdToPrevSessionExercise.size === 0)
      return { exerciseIdToSetCount, recoveryExerciseIds };

    // Update baseline with historical set counts when available.
    // For deload microcycles, halve the historical count (minimum 1 set). We don't use baseline
    // because the user may have adjusted over the mesocycle in a way that the baseline is actually
    // a higher set count than what would be calculated by halving the previous microcycle's sets.
    //
    // For exercises returning from recovery, use the estimated MAV from volume landmarks
    // when available, instead of the pre-recovery historical count.
    const primaryMuscleGroupId = muscleGroupExerciseCTOs[0]?.primaryMuscleGroups[0];
    const volumeLandmark = primaryMuscleGroupId
      ? context.muscleGroupToVolumeLandmarkMap.get(primaryMuscleGroupId)
      : undefined;

    muscleGroupExerciseCTOs.forEach((cto) => {
      const previousSessionExercise = exerciseIdToPrevSessionExercise.get(cto._id);
      if (previousSessionExercise) {
        let setCount: number;

        if (exercisesThatWerePreviouslyInRecovery.has(cto._id) && volumeLandmark) {
          // Exercise is returning from recovery — resume at the estimated MAV
          setCount = Math.min(volumeLandmark.estimatedMav, this.MAX_SETS_PER_EXERCISE);
        } else {
          setCount = Math.min(previousSessionExercise.setOrder.length, this.MAX_SETS_PER_EXERCISE);
        }

        if (isDeloadMicrocycle) {
          setCount = Math.max(1, Math.floor(setCount / 2));
        }
        exerciseIdToSetCount.set(cto._id, setCount);
      }
    });

    // Deload microcycles and zero-progression cycles (Resensitization) skip SFR-based set additions
    if (isDeloadMicrocycle || progressionInterval === 0) {
      return { exerciseIdToSetCount, recoveryExerciseIds };
    }

    /**
     * Determines if the session for the given exercise is already capped for this muscle group.
     */
    function sessionIsCapped(exerciseId: UUID): boolean {
      if (!context.exerciseIdToSessionIndex) {
        throw new Error(
          'WorkoutMesocyclePlanContext.exerciseIdToSessionIndex is not initialized. This should be set during mesocycle planning.'
        );
      }
      const sessionIndex = context.exerciseIdToSessionIndex.get(exerciseId);
      if (sessionIndex === undefined) return false;

      const exerciseIdsInSession = sessionIndexToExerciseIds.get(sessionIndex);
      if (!exerciseIdsInSession) return false;
      let totalSetsInSession = 0;
      exerciseIdsInSession.forEach((id) => {
        // Use the sets from the previous microcycle's session exercise
        totalSetsInSession += exerciseIdToPrevSessionExercise.get(id)?.setOrder.length || 0;
      });
      return (
        totalSetsInSession >= WorkoutVolumePlanningService.MAX_SETS_PER_MUSCLE_GROUP_PER_SESSION
      );
    }

    // 3. Determine sets to add and valid candidates
    let totalSetsToAdd = 0;
    const candidates: {
      exerciseId: UUID;
      sfr: number;
      muscleGroupIndex: number;
      previousSetCount: number;
    }[] = [];
    muscleGroupExerciseCTOs.forEach((cto, muscleGroupIndex) => {
      const previousSessionExercise = exerciseIdToPrevSessionExercise.get(cto._id);
      if (!previousSessionExercise) return;

      let recommendation: number | null;
      if (!exercisesThatWerePreviouslyInRecovery.has(cto._id)) {
        recommendation =
          WorkoutSessionExerciseService.getRecommendedSetAdditionsOrRecovery(
            previousSessionExercise
          );
      } else {
        // If previously in recovery, do not recommend adding sets this microcycle. Also, this is
        // the only thing we are overriding. We still want to use the historical data for
        // SFR calculations, even though that one was the one that triggered a recovery session.
        // This should make it so that it is less likely to have sets added to it.
        recommendation = 0;
      }

      if (recommendation === -1) {
        recoveryExerciseIds.add(cto._id);
        // Cut sets in half (rounded down, minimum 1) for recovery
        const previousSetCount = previousSessionExercise.setOrder.length;
        const recoverySets = Math.max(1, Math.floor(previousSetCount / 2));
        exerciseIdToSetCount.set(cto._id, recoverySets);
      } else if (recommendation !== null && recommendation >= 0) {
        totalSetsToAdd += recommendation;

        // Consider as candidate if session is not already capped
        if (
          previousSessionExercise.setOrder.length < this.MAX_SETS_PER_EXERCISE &&
          !sessionIsCapped(cto._id)
        ) {
          candidates.push({
            exerciseId: cto._id,
            // Don't error if SFR is null for now, just treat as very low
            sfr:
              WorkoutSessionExerciseService.getSFR(previousSessionExercise) ??
              Number.NEGATIVE_INFINITY,
            muscleGroupIndex,
            previousSetCount: previousSessionExercise.setOrder.length
          });
        }
      }
    });

    // Return if nothing to add or no candidates
    if (totalSetsToAdd === 0 || candidates.length === 0) {
      return { exerciseIdToSetCount, recoveryExerciseIds };
    }

    // 4. Distribute added sets based on SFR quality
    // Sort by SFR descending, then by muscleGroupIndex ascending (as tie-breaker)
    candidates.sort((candidateA, candidateB) =>
      candidateA.sfr !== candidateB.sfr
        ? candidateB.sfr - candidateA.sfr
        : candidateA.muscleGroupIndex - candidateB.muscleGroupIndex
    );

    /**
     * Gets the total sets currently planned for a session.
     */
    function getSessionTotal(exerciseId: UUID): number {
      if (!context.exerciseIdToSessionIndex) return 0;
      const sessionIndex = context.exerciseIdToSessionIndex.get(exerciseId);
      if (sessionIndex === undefined) return 0;

      const exerciseIdsInSession = sessionIndexToExerciseIds.get(sessionIndex);
      if (!exerciseIdsInSession) return 0;

      let total = 0;
      exerciseIdsInSession.forEach((id) => {
        total += exerciseIdToSetCount.get(id) || 0;
      });
      return total;
    }

    /**
     * Attempts to add sets to an exercise, respecting all constraints.
     * Returns the number of sets actually added.
     */
    function addSetsToExercise(exerciseId: UUID, setsToAdd: number): number {
      const currentSets = exerciseIdToSetCount.get(exerciseId) || 0;
      const sessionTotal = getSessionTotal(exerciseId);

      const maxDueToExerciseLimit =
        WorkoutVolumePlanningService.MAX_SETS_PER_EXERCISE - currentSets;
      const maxDueToSessionLimit =
        WorkoutVolumePlanningService.MAX_SETS_PER_MUSCLE_GROUP_PER_SESSION - sessionTotal;
      const maxAddable = Math.min(
        setsToAdd,
        maxDueToExerciseLimit,
        maxDueToSessionLimit,
        WorkoutVolumePlanningService.MAX_SET_ADDITION_PER_EXERCISE
      );

      if (maxAddable > 0) {
        exerciseIdToSetCount.set(exerciseId, currentSets + maxAddable);
      }
      return maxAddable;
    }

    let setsRemaining =
      totalSetsToAdd >= WorkoutVolumePlanningService.MAX_TOTAL_SET_ADDITIONS
        ? WorkoutVolumePlanningService.MAX_TOTAL_SET_ADDITIONS
        : totalSetsToAdd;
    for (const candidate of candidates) {
      const added = addSetsToExercise(candidate.exerciseId, setsRemaining);
      setsRemaining -= added;
      if (setsRemaining === 0) break;
    }

    return { exerciseIdToSetCount, recoveryExerciseIds };
  }

  /**
   * Calculates the default number of sets for an exercise based on microcycle progression.
   *
   * Key rule: set progression is distributed across exercises that share the same primary muscle group
   * for the entire microcycle, regardless of which session those exercises are in.
   *
   * Baseline: 2 sets per exercise in the muscle group.
   * Progression: add 1 set per muscle group every `progressionInterval` microcycles.
   * - MuscleGain (interval 1): every microcycle
   * - Cut (interval 2): every other microcycle
   * - Resensitization (interval 0): no progression (flat 2 sets per exercise)
   *
   * @param microcycleIndex The index of the current microcycle.
   * @param totalExercisesInMuscleGroupForMicrocycle Total exercises in the muscle group for
   * this microcycle.
   * @param exerciseIndexInMuscleGroupForMicrocycle Index of the current exercise within the
   * muscle group.
   * @param isDeloadMicrocycle Whether this is a deload microcycle.
   * @param progressionInterval Number of microcycles between each set addition. 0 means no
   * progression.
   */
  private static calculateBaselineSetCount(
    microcycleIndex: number,
    totalExercisesInMuscleGroupForMicrocycle: number,
    exerciseIndexInMuscleGroupForMicrocycle: number,
    isDeloadMicrocycle: boolean,
    progressionInterval: number = 1
  ): number {
    // Deload microcycle: half the sets from the previous microcycle, minimum 1 set.
    if (isDeloadMicrocycle) {
      const baselineSets = this.calculateBaselineSetCount(
        microcycleIndex - 1,
        totalExercisesInMuscleGroupForMicrocycle,
        exerciseIndexInMuscleGroupForMicrocycle,
        false,
        progressionInterval
      );
      return Math.max(1, Math.floor(baselineSets / 2));
    }

    // Total sets to distribute for this muscle group in this microcycle.
    const progressionSets =
      progressionInterval === 0 ? 0 : Math.ceil(microcycleIndex / progressionInterval);
    const totalSets = 2 * totalExercisesInMuscleGroupForMicrocycle + progressionSets;

    // Distribute sets evenly, with earlier exercises getting extra sets from the remainder.
    const baseSetsPerExercise = Math.floor(totalSets / totalExercisesInMuscleGroupForMicrocycle);
    const remainder = totalSets % totalExercisesInMuscleGroupForMicrocycle;

    return exerciseIndexInMuscleGroupForMicrocycle < remainder
      ? baseSetsPerExercise + 1
      : baseSetsPerExercise;
  }
}
