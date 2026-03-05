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

/** An exercise eligible to receive additional sets during SFR-based distribution. */
type SetAdditionCandidate = {
  exerciseId: UUID;
  sfr: number;
  muscleGroupIndex: number;
  previousSetCount: number;
};

/**
 * A service for handling volume planning operations across microcycles.
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

  /** RSM bracket upper bound for "below MEV" (0 to this value inclusive). */
  private static readonly MEV_BELOW_RSM_THRESHOLD = 3;

  /** Recommended set adjustment when volume is below MEV. */
  private static readonly MEV_BELOW_SET_ADJUSTMENT = 3;

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
   * Evaluates whether a muscle group's volume is below MEV based on RSM scores from the first
   * microcycle. Called when generating the second microcycle to boost volume when RSM is low.
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
    /**
     * Recommended total set adjustment for this muscle group.
     * +3 when average RSM is low (0-3), 0 otherwise.
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

    if (bracket <= this.MEV_BELOW_RSM_THRESHOLD) {
      return { recommendedSetAdjustment: this.MEV_BELOW_SET_ADJUSTMENT, averageRsm };
    }
    return { recommendedSetAdjustment: 0, averageRsm };
  }

  /**
   * Calculates the set count for each exercise in a particular muscle group for this microcycle.
   *
   * Pipeline:
   * 1. **Baseline** — Calculate default set counts from progression rules
   * 2. **Resolve history** — Find the most recent session exercise data for each exercise
   * 3. **Apply history** — Override baselines with historical set counts (or MAV for recovery returns)
   * 4. **Evaluate SFR** — Determine recovery exercises and candidates for set additions
   * 5. **Distribute sets** — Allocate added sets to candidates by SFR quality
   *
   * Falls back to baseline when no previous microcycle data exists.
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

    // 1. Calculate baselines and build session-to-exercise index
    muscleGroupExerciseCTOs.forEach((cto, index) => {
      const baseline = this.calculateBaselineSetCount(
        microcycleIndex,
        muscleGroupExerciseCTOs.length,
        index,
        isDeloadMicrocycle,
        progressionInterval
      );
      exerciseIdToSetCount.set(cto._id, Math.min(baseline, this.MAX_SETS_PER_EXERCISE));

      if (!context.exerciseIdToSessionIndex) return;
      const exerciseSessionIndex = context.exerciseIdToSessionIndex.get(cto._id);
      if (exerciseSessionIndex === undefined) return;
      const existingExerciseIdsForSession =
        sessionIndexToExerciseIds.get(exerciseSessionIndex) || [];
      existingExerciseIdsForSession.push(cto._id);
      sessionIndexToExerciseIds.set(exerciseSessionIndex, existingExerciseIdsForSession);
    });

    // 2. Resolve historical data — returns null if no usable history exists
    const exerciseIds = new Set(muscleGroupExerciseCTOs.map((cto) => cto._id));
    const historicalData = this.resolveHistoricalExerciseData(
      context,
      microcycleIndex,
      exerciseIds
    );
    if (!historicalData) return { exerciseIdToSetCount, recoveryExerciseIds };

    // 3. Apply historical set counts (overrides baselines)
    const primaryMuscleGroupId = muscleGroupExerciseCTOs[0]?.primaryMuscleGroups[0];
    const volumeLandmark = primaryMuscleGroupId
      ? context.muscleGroupToVolumeLandmarkMap.get(primaryMuscleGroupId)
      : undefined;

    this.applyHistoricalSetCounts(
      muscleGroupExerciseCTOs,
      historicalData.exerciseIdToPrevSessionExercise,
      historicalData.exercisesThatWerePreviouslyInRecovery,
      exerciseIdToSetCount,
      isDeloadMicrocycle,
      volumeLandmark
    );

    // Deload microcycles and zero-progression cycles (Resensitization) skip SFR-based set additions
    if (isDeloadMicrocycle || progressionInterval === 0) {
      return { exerciseIdToSetCount, recoveryExerciseIds };
    }

    // 4. Evaluate SFR recommendations (MEV boost + per-exercise SFR + recovery detection)
    const { totalSetsToAdd, candidates } = this.evaluateSfrRecommendations(
      context,
      microcycleIndex,
      muscleGroupExerciseCTOs,
      historicalData.exerciseIdToPrevSessionExercise,
      historicalData.exercisesThatWerePreviouslyInRecovery,
      exerciseIdToSetCount,
      recoveryExerciseIds,
      primaryMuscleGroupId,
      sessionIndexToExerciseIds
    );

    if (totalSetsToAdd === 0 || candidates.length === 0) {
      return { exerciseIdToSetCount, recoveryExerciseIds };
    }

    // 5. Distribute added sets to candidates by SFR quality
    this.distributeSetsToExercises(
      candidates,
      totalSetsToAdd,
      exerciseIdToSetCount,
      context.exerciseIdToSessionIndex,
      sessionIndexToExerciseIds
    );

    return { exerciseIdToSetCount, recoveryExerciseIds };
  }

  /**
   * Walks backward through completed microcycles to find the most recent non-recovery
   * session exercise for each exercise in the muscle group.
   *
   * Returns `null` when no usable historical data exists (no previous microcycle, or
   * previous microcycles are incomplete/have no matching exercises).
   *
   * @param context The mesocycle planning context.
   * @param microcycleIndex The current microcycle index.
   * @param exerciseIds The exercise IDs to search for.
   */
  private static resolveHistoricalExerciseData(
    context: WorkoutMesocyclePlanContext,
    microcycleIndex: number,
    exerciseIds: Set<UUID>
  ): {
    exerciseIdToPrevSessionExercise: Map<UUID, WorkoutSessionExercise>;
    exercisesThatWerePreviouslyInRecovery: Set<UUID>;
  } | null {
    let previousMicrocycleIndex = microcycleIndex - 1;
    let previousMicrocycle = context.microcyclesInOrder[previousMicrocycleIndex];
    if (!previousMicrocycle) return null;

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

      // Scan all session exercises in this microcycle for matching non-recovery exercises
      for (const sessionId of previousMicrocycle.sessionOrder) {
        const session = context.sessionMap.get(sessionId);
        if (!session) continue;
        for (const sessionExerciseId of session.sessionExerciseOrder) {
          const sessionExercise = context.sessionExerciseMap.get(sessionExerciseId);
          if (
            sessionExercise &&
            exerciseIds.has(sessionExercise.workoutExerciseId) &&
            !foundExerciseIds.has(sessionExercise.workoutExerciseId) &&
            !sessionExercise.isRecoveryExercise
          ) {
            exerciseIdToPrevSessionExercise.set(sessionExercise.workoutExerciseId, sessionExercise);
            foundExerciseIds.add(sessionExercise.workoutExerciseId);
            // If we had to go back more than one microcycle, the exercise was in recovery
            if (previousMicrocycleIndex < microcycleIndex - 1) {
              exercisesThatWerePreviouslyInRecovery.add(sessionExercise.workoutExerciseId);
            }
          }
        }
      }
      previousMicrocycleIndex = previousMicrocycleIndex - 1;
      previousMicrocycle = context.microcyclesInOrder[previousMicrocycleIndex];
    }

    if (exerciseIdToPrevSessionExercise.size === 0) return null;
    return { exerciseIdToPrevSessionExercise, exercisesThatWerePreviouslyInRecovery };
  }

  /**
   * Overrides baseline set counts with historical data from the previous microcycle.
   *
   * For exercises returning from recovery, uses the estimated MAV from volume landmarks
   * when available. For deload microcycles, halves the historical count (minimum 1 set).
   *
   * @param muscleGroupExerciseCTOs Exercises in this muscle group.
   * @param exerciseIdToPrevSessionExercise Map from exercise ID to its previous session exercise.
   * @param exercisesThatWerePreviouslyInRecovery Exercises returning from recovery.
   * @param exerciseIdToSetCount Current set count assignments (mutated).
   * @param isDeloadMicrocycle Whether this is a deload microcycle.
   * @param volumeLandmark Volume landmark estimate for the primary muscle group, if available.
   */
  private static applyHistoricalSetCounts(
    muscleGroupExerciseCTOs: WorkoutExerciseCTO[],
    exerciseIdToPrevSessionExercise: Map<UUID, WorkoutSessionExercise>,
    exercisesThatWerePreviouslyInRecovery: Set<UUID>,
    exerciseIdToSetCount: Map<UUID, number>,
    isDeloadMicrocycle: boolean,
    volumeLandmark: WorkoutVolumeLandmarkEstimate | undefined
  ): void {
    muscleGroupExerciseCTOs.forEach((cto) => {
      const previousSessionExercise = exerciseIdToPrevSessionExercise.get(cto._id);
      if (!previousSessionExercise) return;

      let setCount: number;
      if (exercisesThatWerePreviouslyInRecovery.has(cto._id) && volumeLandmark) {
        // Returning from recovery — use estimated MAV as a safe re-entry volume
        setCount = Math.min(volumeLandmark.estimatedMav, this.MAX_SETS_PER_EXERCISE);
      } else {
        // Carry forward last microcycle's set count
        setCount = Math.min(previousSessionExercise.setOrder.length, this.MAX_SETS_PER_EXERCISE);
      }

      if (isDeloadMicrocycle) {
        // Deload: halve volume, minimum 1 set
        setCount = Math.max(1, Math.floor(setCount / 2));
      }
      exerciseIdToSetCount.set(cto._id, setCount);
    });
  }

  /**
   * Evaluates each exercise's performance feedback to determine recovery exercises,
   * set addition recommendations, and candidates for volume increases. Also includes
   * the MEV boost for the second microcycle.
   *
   * @param context The mesocycle planning context.
   * @param microcycleIndex The current microcycle index.
   * @param muscleGroupExerciseCTOs Exercises in this muscle group.
   * @param exerciseIdToPrevSessionExercise Map from exercise ID to its previous session exercise.
   * @param exercisesThatWerePreviouslyInRecovery Exercises returning from recovery.
   * @param exerciseIdToSetCount Current set count assignments (mutated for recovery exercises).
   * @param recoveryExerciseIds Set of exercise IDs flagged for recovery (mutated).
   * @param primaryMuscleGroupId The primary muscle group ID, for MEV evaluation.
   * @param sessionIndexToExerciseIds Map from session index to exercise IDs in that session.
   */
  private static evaluateSfrRecommendations(
    context: WorkoutMesocyclePlanContext,
    microcycleIndex: number,
    muscleGroupExerciseCTOs: WorkoutExerciseCTO[],
    exerciseIdToPrevSessionExercise: Map<UUID, WorkoutSessionExercise>,
    exercisesThatWerePreviouslyInRecovery: Set<UUID>,
    exerciseIdToSetCount: Map<UUID, number>,
    recoveryExerciseIds: Set<UUID>,
    primaryMuscleGroupId: UUID | undefined,
    sessionIndexToExerciseIds: Map<number, UUID[]>
  ): { totalSetsToAdd: number; candidates: SetAdditionCandidate[] } {
    let totalSetsToAdd = 0;

    // MEV proximity boost: if microcycle 1 RSM was low, add sets to approach MEV
    if (
      microcycleIndex === 1 &&
      primaryMuscleGroupId &&
      context.muscleGroupToVolumeLandmarkMap.size > 0
    ) {
      const mevResult = this.evaluateMevProximity(context, primaryMuscleGroupId);
      if (mevResult && mevResult.recommendedSetAdjustment > 0) {
        totalSetsToAdd += mevResult.recommendedSetAdjustment;
      }
    }

    const candidates: SetAdditionCandidate[] = [];
    muscleGroupExerciseCTOs.forEach((cto, muscleGroupIndex) => {
      const previousSessionExercise = exerciseIdToPrevSessionExercise.get(cto._id);
      if (!previousSessionExercise) return;

      // Get SFR-based recommendation: positive = add sets, 0 = maintain, -1 = recovery needed
      let recommendation: number | null;
      if (!exercisesThatWerePreviouslyInRecovery.has(cto._id)) {
        recommendation =
          WorkoutSessionExerciseService.getRecommendedSetAdditionsOrRecovery(
            previousSessionExercise
          );
      } else {
        // Returning from recovery — don't add sets yet, but still use SFR for candidate ranking
        recommendation = 0;
      }

      if (recommendation === -1) {
        // Recovery needed: halve sets and flag as recovery exercise
        recoveryExerciseIds.add(cto._id);
        const previousSetCount = previousSessionExercise.setOrder.length;
        const recoverySets = Math.max(1, Math.floor(previousSetCount / 2));
        exerciseIdToSetCount.set(cto._id, recoverySets);
      } else if (recommendation !== null && recommendation >= 0) {
        // Accumulate SFR-recommended additions into shared total
        totalSetsToAdd += recommendation;

        // Only exercises below per-exercise cap and in uncapped sessions are candidates
        if (
          previousSessionExercise.setOrder.length < this.MAX_SETS_PER_EXERCISE &&
          !this.sessionIsCapped(
            cto._id,
            context.exerciseIdToSessionIndex,
            sessionIndexToExerciseIds,
            exerciseIdToPrevSessionExercise
          )
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

    return { totalSetsToAdd, candidates };
  }

  /**
   * Distributes added sets across candidate exercises, prioritizing higher SFR scores.
   * Respects per-exercise, per-session, and per-addition caps.
   *
   * @param candidates Exercises eligible for set additions, with SFR scores.
   * @param totalSetsToAdd Total sets recommended for addition (before capping).
   * @param exerciseIdToSetCount Current set count assignments (mutated).
   * @param exerciseIdToSessionIndex Map from exercise ID to its session index.
   * @param sessionIndexToExerciseIds Map from session index to exercise IDs in that session.
   */
  private static distributeSetsToExercises(
    candidates: SetAdditionCandidate[],
    totalSetsToAdd: number,
    exerciseIdToSetCount: Map<UUID, number>,
    exerciseIdToSessionIndex: Map<UUID, number> | undefined,
    sessionIndexToExerciseIds: Map<number, UUID[]>
  ): void {
    // Prioritize exercises with highest SFR (best stimulus-to-fatigue ratio)
    candidates.sort((candidateA, candidateB) =>
      candidateA.sfr !== candidateB.sfr
        ? candidateB.sfr - candidateA.sfr
        : candidateA.muscleGroupIndex - candidateB.muscleGroupIndex
    );

    // Cap total additions at MAX_TOTAL_SET_ADDITIONS regardless of raw recommendation
    let setsRemaining =
      totalSetsToAdd >= this.MAX_TOTAL_SET_ADDITIONS
        ? this.MAX_TOTAL_SET_ADDITIONS
        : totalSetsToAdd;

    // Distribute sets one candidate at a time until budget is exhausted
    for (const candidate of candidates) {
      const added = this.addSetsToExercise(
        candidate.exerciseId,
        setsRemaining,
        exerciseIdToSetCount,
        exerciseIdToSessionIndex,
        sessionIndexToExerciseIds
      );
      setsRemaining -= added;
      if (setsRemaining === 0) break;
    }
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

  /**
   * Determines if the session containing the given exercise is already at the
   * per-muscle-group-per-session cap, based on previous microcycle set counts.
   *
   * @param exerciseId The exercise to check.
   * @param exerciseIdToSessionIndex Map from exercise ID to its session index.
   * @param sessionIndexToExerciseIds Map from session index to exercise IDs in that session.
   * @param exerciseIdToPrevSessionExercise Map from exercise ID to its previous session exercise.
   */
  private static sessionIsCapped(
    exerciseId: UUID,
    exerciseIdToSessionIndex: Map<UUID, number> | undefined,
    sessionIndexToExerciseIds: Map<number, UUID[]>,
    exerciseIdToPrevSessionExercise: Map<UUID, WorkoutSessionExercise>
  ): boolean {
    if (!exerciseIdToSessionIndex) {
      throw new Error(
        'WorkoutMesocyclePlanContext.exerciseIdToSessionIndex is not initialized. This should be set during mesocycle planning.'
      );
    }
    const sessionIndex = exerciseIdToSessionIndex.get(exerciseId);
    if (sessionIndex === undefined) return false;

    const exerciseIdsInSession = sessionIndexToExerciseIds.get(sessionIndex);
    if (!exerciseIdsInSession) return false;
    let totalSetsInSession = 0;
    exerciseIdsInSession.forEach((id) => {
      totalSetsInSession += exerciseIdToPrevSessionExercise.get(id)?.setOrder.length || 0;
    });
    return totalSetsInSession >= this.MAX_SETS_PER_MUSCLE_GROUP_PER_SESSION;
  }

  /**
   * Gets the total sets currently planned for a session containing the given exercise.
   *
   * @param exerciseId The exercise whose session total to compute.
   * @param exerciseIdToSetCount Current set count assignments.
   * @param exerciseIdToSessionIndex Map from exercise ID to its session index.
   * @param sessionIndexToExerciseIds Map from session index to exercise IDs in that session.
   */
  private static getSessionSetTotal(
    exerciseId: UUID,
    exerciseIdToSetCount: Map<UUID, number>,
    exerciseIdToSessionIndex: Map<UUID, number> | undefined,
    sessionIndexToExerciseIds: Map<number, UUID[]>
  ): number {
    if (!exerciseIdToSessionIndex) return 0;
    const sessionIndex = exerciseIdToSessionIndex.get(exerciseId);
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
   * Attempts to add sets to an exercise, respecting per-exercise, per-session, and
   * per-addition caps. Mutates `exerciseIdToSetCount` in place.
   *
   * @param exerciseId The exercise to add sets to.
   * @param setsToAdd The desired number of sets to add.
   * @param exerciseIdToSetCount Current set count assignments (mutated).
   * @param exerciseIdToSessionIndex Map from exercise ID to its session index.
   * @param sessionIndexToExerciseIds Map from session index to exercise IDs in that session.
   * @returns The number of sets actually added.
   */
  private static addSetsToExercise(
    exerciseId: UUID,
    setsToAdd: number,
    exerciseIdToSetCount: Map<UUID, number>,
    exerciseIdToSessionIndex: Map<UUID, number> | undefined,
    sessionIndexToExerciseIds: Map<number, UUID[]>
  ): number {
    const currentSets = exerciseIdToSetCount.get(exerciseId) || 0;
    const sessionTotal = this.getSessionSetTotal(
      exerciseId,
      exerciseIdToSetCount,
      exerciseIdToSessionIndex,
      sessionIndexToExerciseIds
    );

    // Respect all caps: per-exercise max, per-session max, and per-addition max
    const maxDueToExerciseLimit = this.MAX_SETS_PER_EXERCISE - currentSets;
    const maxDueToSessionLimit = this.MAX_SETS_PER_MUSCLE_GROUP_PER_SESSION - sessionTotal;
    const maxAddable = Math.min(
      setsToAdd,
      maxDueToExerciseLimit,
      maxDueToSessionLimit,
      this.MAX_SET_ADDITION_PER_EXERCISE
    );

    if (maxAddable > 0) {
      exerciseIdToSetCount.set(exerciseId, currentSets + maxAddable);
    }
    return maxAddable;
  }
}
