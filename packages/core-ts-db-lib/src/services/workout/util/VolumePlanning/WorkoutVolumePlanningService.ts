import type { UUID } from 'crypto';
import type { WorkoutExerciseCTO } from '../../../../ctos/workout/WorkoutExerciseCTO.js';
import type {
  WorkoutMuscleGroupVolumeCTO,
  WorkoutVolumeLandmarkEstimate
} from '../../../../ctos/workout/WorkoutMuscleGroupVolumeCTO.js';
import type { WorkoutSessionExercise } from '../../../../documents/workout/WorkoutSessionExercise.js';
import type WorkoutMesocyclePlanContext from '../../Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutSessionExerciseService from '../../SessionExercise/WorkoutSessionExerciseService.js';

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
  /**
   * Controls the volume *progression rate* across accumulation microcycles.
   *
   * Both modes start at estimated MEV when historical volume data exists
   * (falling back to 2 sets per exercise when no history is available).
   *
   * When `false` (default): legacy progression — adds 1 set per muscle group
   * every `progressionInterval` microcycles from the MEV starting point.
   *
   * When `true`: MEV-to-MRV interpolation — linearly distributes sets from
   * estimated MEV to estimated MRV across all accumulation microcycles.
   *
   * This flag exists to allow toggling between the two progression algorithms
   * while the MEV-to-MRV approach is validated in practice. Once confidence is
   * established, the flag and legacy path should be removed.
   */
  static USE_VOLUME_LANDMARK_PROGRESSION = false;

  private static readonly MAX_SETS_PER_EXERCISE = 8;
  private static readonly MAX_SETS_PER_MUSCLE_GROUP_PER_SESSION = 10;

  /** Minimum average RSM required for a mesocycle to count toward MEV estimation. */
  private static readonly MEV_RSM_THRESHOLD = 4;

  /** Default estimated MEV when no qualifying mesocycle history exists. Per-exercise value. */
  private static readonly DEFAULT_MEV_PER_EXERCISE = 2;

  /** Minimum average performance score (or recovery presence) to count a mesocycle toward MRV estimation. */
  private static readonly MRV_PERFORMANCE_THRESHOLD = 2.5;

  /** Extra sets added above the historical peak when no stressed mesocycles exist, to estimate MRV. */
  private static readonly MRV_HEADROOM = 2;

  /** Default estimated MRV when no mesocycle history exists at all. Per-exercise value. */
  private static readonly DEFAULT_MRV_PER_EXERCISE = 8;

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
      estimatedMev = this.DEFAULT_MEV_PER_EXERCISE;
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
      estimatedMrv = this.DEFAULT_MRV_PER_EXERCISE;
    }

    // Ensure MRV > MEV
    if (estimatedMrv <= estimatedMev) {
      estimatedMrv = estimatedMev + 1;
    }

    const estimatedMav = Math.ceil((estimatedMev + estimatedMrv) / 2);

    return { estimatedMev, estimatedMrv, estimatedMav, mesocycleCount: mesocycleHistory.length };
  }

  /**
   * Calculates the set count for each exercise in a particular muscle group for this microcycle.
   *
   * Pipeline:
   * 1. **Volume targets** — Determine start/end volume from landmarks or defaults
   * 2. **Baseline** — Calculate default set counts from progression rules
   * 3. **Resolve history** — Find the most recent session exercise data for each exercise
   * 4. **Apply history** — Override baselines with historical set counts (or MAV for recovery returns)
   * 5. **Evaluate SFR** — Determine recovery exercises and candidates for set additions
   * 6. **Distribute sets** — Allocate added sets to candidates by SFR quality
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

    // 1. Look up volume landmarks and compute volume targets
    const primaryMuscleGroupId = muscleGroupExerciseCTOs[0]?.primaryMuscleGroups[0];
    const volumeLandmark = primaryMuscleGroupId
      ? context.muscleGroupToVolumeLandmarkMap.get(primaryMuscleGroupId)
      : undefined;

    const { startVolume, endVolume } = this.getVolumeTargetsForMuscleGroup(
      volumeLandmark,
      muscleGroupExerciseCTOs.length,
      progressionInterval
    );

    // 2. Calculate baseline set counts for all exercises in the muscle group
    const baselineCounts = this.calculateBaselineSetCounts(
      microcycleIndex,
      context.accumulationMicrocycleCount,
      muscleGroupExerciseCTOs.length,
      startVolume,
      endVolume,
      isDeloadMicrocycle,
      progressionInterval
    );

    // 3. Assign baselines and build session-to-exercise index
    muscleGroupExerciseCTOs.forEach((cto, index) => {
      exerciseIdToSetCount.set(
        cto._id,
        Math.min(baselineCounts[index], this.MAX_SETS_PER_EXERCISE)
      );

      if (!context.exerciseIdToSessionIndex) return;
      const exerciseSessionIndex = context.exerciseIdToSessionIndex.get(cto._id);
      if (exerciseSessionIndex === undefined) return;
      const existingExerciseIdsForSession =
        sessionIndexToExerciseIds.get(exerciseSessionIndex) || [];
      existingExerciseIdsForSession.push(cto._id);
      sessionIndexToExerciseIds.set(exerciseSessionIndex, existingExerciseIdsForSession);
    });

    // 4. Resolve historical data — returns null if no usable history exists
    const exerciseIds = new Set(muscleGroupExerciseCTOs.map((cto) => cto._id));
    const historicalData = this.resolveHistoricalExerciseData(
      context,
      microcycleIndex,
      exerciseIds
    );
    if (!historicalData) return { exerciseIdToSetCount, recoveryExerciseIds };

    // 5. Apply historical set counts (overrides baselines)
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

    // 6. Evaluate SFR recommendations (per-exercise SFR + recovery detection)
    const { totalSetsToAdd, candidates } = this.evaluateSfrRecommendations(
      context,
      muscleGroupExerciseCTOs,
      historicalData.exerciseIdToPrevSessionExercise,
      historicalData.exercisesThatWerePreviouslyInRecovery,
      exerciseIdToSetCount,
      recoveryExerciseIds,
      sessionIndexToExerciseIds
    );

    if (totalSetsToAdd === 0 || candidates.length === 0) {
      return { exerciseIdToSetCount, recoveryExerciseIds };
    }

    // 7. Distribute added sets to candidates by SFR quality
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
   * Determines the start and end volume targets for a muscle group based on
   * historical volume landmarks and cycle type.
   *
   * @param volumeLandmark Volume landmark estimate from historical data, if available.
   * @param exerciseCount Number of exercises in the muscle group.
   * @param progressionInterval Cycle-type progression interval (1=MuscleGain, 2=Cut, 0=Resensitization).
   */
  private static getVolumeTargetsForMuscleGroup(
    volumeLandmark: WorkoutVolumeLandmarkEstimate | undefined,
    exerciseCount: number,
    progressionInterval: number
  ): { startVolume: number; endVolume: number } {
    // Resensitization (interval=0): flat at estimated MEV (or default when no history)
    if (progressionInterval === 0) {
      const flatVolume =
        volumeLandmark && volumeLandmark.mesocycleCount > 0
          ? volumeLandmark.estimatedMev
          : this.DEFAULT_MEV_PER_EXERCISE * exerciseCount;
      return { startVolume: flatVolume, endVolume: flatVolume };
    }

    // With historical volume landmarks
    if (volumeLandmark && volumeLandmark.mesocycleCount > 0) {
      const startVolume = volumeLandmark.estimatedMev;
      // Cut: progress to MAV (midpoint), not MRV
      let endVolume =
        progressionInterval === 2 ? volumeLandmark.estimatedMav : volumeLandmark.estimatedMrv;

      if (endVolume <= startVolume) {
        endVolume = startVolume + 1;
      }

      return { startVolume, endVolume };
    }

    // No history: use per-exercise defaults
    const startVolume = this.DEFAULT_MEV_PER_EXERCISE * exerciseCount;
    const mrvTotal = this.DEFAULT_MRV_PER_EXERCISE * exerciseCount;

    // Cut: target MAV (midpoint), not MRV
    const endVolume =
      progressionInterval === 2 ? Math.ceil((startVolume + mrvTotal) / 2) : mrvTotal;

    return { startVolume, endVolume };
  }

  /**
   * Calculates the baseline set counts for all exercises in a muscle group for a given microcycle.
   *
   * When {@link USE_VOLUME_LANDMARK_PROGRESSION} is `false` (default), uses the legacy progression
   * rate: +1 set per muscle group every `progressionInterval` microcycles from the starting volume.
   *
   * When `true`, linearly interpolates from `startVolume` to `endVolume` across accumulation
   * microcycles.
   *
   * @param microcycleIndex The index of the current microcycle.
   * @param accumulationMicrocycleCount Number of accumulation (non-deload) microcycles.
   * @param exerciseCount Number of exercises in the muscle group.
   * @param startVolume Total muscle-group volume at microcycle 0.
   * @param endVolume Total muscle-group volume target at the last accumulation microcycle.
   * @param isDeloadMicrocycle Whether this is a deload microcycle.
   * @param progressionInterval Microcycles between each set addition (0 = no progression).
   */
  private static calculateBaselineSetCounts(
    microcycleIndex: number,
    accumulationMicrocycleCount: number,
    exerciseCount: number,
    startVolume: number,
    endVolume: number,
    isDeloadMicrocycle: boolean,
    progressionInterval: number
  ): number[] {
    if (isDeloadMicrocycle) {
      const lastAccumulationCounts = this.calculateBaselineSetCounts(
        microcycleIndex - 1,
        accumulationMicrocycleCount,
        exerciseCount,
        startVolume,
        endVolume,
        false,
        progressionInterval
      );
      return lastAccumulationCounts.map((count) => Math.max(1, Math.floor(count / 2)));
    }

    let totalSets: number;

    if (this.USE_VOLUME_LANDMARK_PROGRESSION) {
      // Linear interpolation from startVolume to endVolume
      if (accumulationMicrocycleCount <= 1) {
        totalSets = startVolume;
      } else {
        totalSets = Math.round(
          startVolume +
            ((endVolume - startVolume) * microcycleIndex) / (accumulationMicrocycleCount - 1)
        );
      }
    } else {
      // Legacy progression: +1 set per muscle group per progressionInterval microcycles
      const progressionSets =
        progressionInterval === 0 ? 0 : Math.ceil(microcycleIndex / progressionInterval);
      totalSets = startVolume + progressionSets;
    }

    return this.distributeEvenly(totalSets, exerciseCount);
  }

  /**
   * Distributes a total evenly across N slots, with remainder going to earlier slots.
   *
   * @param total The total to distribute.
   * @param slots The number of slots to distribute across.
   */
  private static distributeEvenly(total: number, slots: number): number[] {
    const base = Math.floor(total / slots);
    const remainder = total % slots;
    return Array.from({ length: slots }, (_, i) => (i < remainder ? base + 1 : base));
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
   * For exercises returning from recovery, distributes the estimated MAV from volume
   * landmarks proportionally across exercises. For deload microcycles, halves the
   * historical count (minimum 1 set).
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
    // Pre-compute per-exercise MAV distribution for exercises returning from recovery.
    // Uses floor-based even distribution (conservative) per the source material's guidance
    // to err on the lighter side when returning from recovery.
    const hasExerciseReturningFromRecovery = muscleGroupExerciseCTOs.some((cto) =>
      exercisesThatWerePreviouslyInRecovery.has(cto._id)
    );
    const mavDistribution =
      hasExerciseReturningFromRecovery && volumeLandmark
        ? this.distributeEvenly(volumeLandmark.estimatedMav, muscleGroupExerciseCTOs.length)
        : undefined;

    muscleGroupExerciseCTOs.forEach((cto, index) => {
      const previousSessionExercise = exerciseIdToPrevSessionExercise.get(cto._id);
      if (!previousSessionExercise) return;

      let setCount: number;
      if (exercisesThatWerePreviouslyInRecovery.has(cto._id) && mavDistribution) {
        // Returning from recovery — resume at conservatively distributed MAV
        setCount = Math.min(mavDistribution[index], this.MAX_SETS_PER_EXERCISE);
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
   * set addition recommendations, and candidates for volume increases.
   *
   * @param context The mesocycle planning context.
   * @param muscleGroupExerciseCTOs Exercises in this muscle group.
   * @param exerciseIdToPrevSessionExercise Map from exercise ID to its previous session exercise.
   * @param exercisesThatWerePreviouslyInRecovery Exercises returning from recovery.
   * @param exerciseIdToSetCount Current set count assignments (mutated for recovery exercises).
   * @param recoveryExerciseIds Set of exercise IDs flagged for recovery (mutated).
   * @param sessionIndexToExerciseIds Map from session index to exercise IDs in that session.
   */
  private static evaluateSfrRecommendations(
    context: WorkoutMesocyclePlanContext,
    muscleGroupExerciseCTOs: WorkoutExerciseCTO[],
    exerciseIdToPrevSessionExercise: Map<UUID, WorkoutSessionExercise>,
    exercisesThatWerePreviouslyInRecovery: Set<UUID>,
    exerciseIdToSetCount: Map<UUID, number>,
    recoveryExerciseIds: Set<UUID>,
    sessionIndexToExerciseIds: Map<number, UUID[]>
  ): { totalSetsToAdd: number; candidates: SetAdditionCandidate[] } {
    let totalSetsToAdd = 0;

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
