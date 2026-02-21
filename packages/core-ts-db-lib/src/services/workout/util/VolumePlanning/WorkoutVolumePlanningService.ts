import type { UUID } from 'crypto';
import type { CalibrationExercisePair } from '../../../../documents/workout/WorkoutExerciseCalibration.js';
import type { WorkoutSessionExercise } from '../../../../documents/workout/WorkoutSessionExercise.js';
import type WorkoutMesocyclePlanContext from '../../Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutSessionExerciseService from '../../SessionExercise/WorkoutSessionExerciseService.js';

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

  /**
   * Calculates the set plan for an entire microcycle.
   */
  static calculateSetPlanForMicrocycle(
    context: WorkoutMesocyclePlanContext,
    microcycleIndex: number,
    isDeloadMicrocycle: boolean
  ): { exerciseIdToSetCount: Map<UUID, number>; recoveryExerciseIds: Set<UUID> } {
    if (!context.muscleGroupToExercisePairsMap) {
      throw new Error(
        'WorkoutMesocyclePlanContext.muscleGroupToExercisePairsMap is not initialized. This should be set during mesocycle planning.'
      );
    }

    const exerciseIdToSetCount = new Map<UUID, number>();
    const recoveryExerciseIds = new Set<UUID>();

    context.muscleGroupToExercisePairsMap.values().forEach((muscleGroupExercisePairs) => {
      const result = this.calculateSetCountForEachExerciseInMuscleGroup(
        context,
        microcycleIndex,
        muscleGroupExercisePairs,
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
   * Calculates the set count for each exercise in a particular muscle group for this microcycle.
   *
   * If there is no previous microcycle data for the muscle group, this falls back to
   * the baseline progression rules.
   */
  private static calculateSetCountForEachExerciseInMuscleGroup(
    context: WorkoutMesocyclePlanContext,
    microcycleIndex: number,
    muscleGroupExercisePairs: CalibrationExercisePair[],
    isDeloadMicrocycle: boolean
  ): { exerciseIdToSetCount: Map<UUID, number>; recoveryExerciseIds: Set<UUID> } {
    const exerciseIdToSetCount = new Map<UUID, number>();
    const recoveryExerciseIds = new Set<UUID>();
    const sessionIndexToExerciseIds = new Map<number, UUID[]>();

    // 1. Calculate baselines for all exercises in muscle group
    muscleGroupExercisePairs.forEach((pair, index) => {
      const baseline = this.calculateBaselineSetCount(
        microcycleIndex,
        muscleGroupExercisePairs.length,
        index,
        isDeloadMicrocycle
      );
      exerciseIdToSetCount.set(pair.exercise._id, Math.min(baseline, this.MAX_SETS_PER_EXERCISE));

      // Build out the map for session indices to the array of exercise IDs as it pertains to this
      // muscle group.
      if (!context.exerciseIdToSessionIndex) return;
      const exerciseSessionIndex = context.exerciseIdToSessionIndex.get(pair.exercise._id);
      if (exerciseSessionIndex === undefined) return;
      const existingExerciseIdsForSession =
        sessionIndexToExerciseIds.get(exerciseSessionIndex) || [];
      existingExerciseIdsForSession.push(pair.exercise._id);
      sessionIndexToExerciseIds.set(exerciseSessionIndex, existingExerciseIdsForSession);
    });

    // 2. Resolve historical performance data
    // Return if no previous microcycle
    let previousMicrocycleIndex = microcycleIndex - 1;
    let previousMicrocycle = context.microcyclesInOrder[previousMicrocycleIndex];
    if (!previousMicrocycle) return { exerciseIdToSetCount, recoveryExerciseIds };

    // Map previous session exercises
    const exerciseIds = new Set(muscleGroupExercisePairs.map((p) => p.exercise._id));
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

    // Update baseline with historical set counts when available
    muscleGroupExercisePairs.forEach((pair) => {
      const previousSessionExercise = exerciseIdToPrevSessionExercise.get(pair.exercise._id);
      if (previousSessionExercise) {
        exerciseIdToSetCount.set(
          pair.exercise._id,
          Math.min(previousSessionExercise.setOrder.length, this.MAX_SETS_PER_EXERCISE)
        );
      }
    });

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
    muscleGroupExercisePairs.forEach((pair, muscleGroupIndex) => {
      const previousSessionExercise = exerciseIdToPrevSessionExercise.get(pair.exercise._id);
      if (!previousSessionExercise) return;

      let recommendation: number | null;
      if (!exercisesThatWerePreviouslyInRecovery.has(pair.exercise._id)) {
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
        recoveryExerciseIds.add(pair.exercise._id);
        // Cut sets in half (rounded down, minimum 1) for recovery
        const previousSetCount = previousSessionExercise.setOrder.length;
        const recoverySets = Math.max(1, Math.floor(previousSetCount / 2));
        exerciseIdToSetCount.set(pair.exercise._id, recoverySets);
      } else if (recommendation != null && recommendation >= 0) {
        totalSetsToAdd += recommendation;

        // Consider as candidate if session is not already capped
        if (
          previousSessionExercise.setOrder.length < this.MAX_SETS_PER_EXERCISE &&
          !sessionIsCapped(pair.exercise._id)
        ) {
          candidates.push({
            exerciseId: pair.exercise._id,
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
      // Hard limit of 2 to add to a particular exercise at once
      const maxAddable = Math.min(setsToAdd, maxDueToExerciseLimit, maxDueToSessionLimit, 2);

      if (maxAddable > 0) {
        exerciseIdToSetCount.set(exerciseId, currentSets + maxAddable);
      }
      return maxAddable;
    }

    // Cap the actual sets to add to 3 total
    let setsRemaining = totalSetsToAdd >= 3 ? 3 : totalSetsToAdd;
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
   * Progression: add 1 total set per microcycle per muscle group (distributed to earlier exercises
   * in the muscle-group-wide ordering).
   */
  private static calculateBaselineSetCount(
    microcycleIndex: number,
    totalExercisesInMuscleGroupForMicrocycle: number,
    exerciseIndexInMuscleGroupForMicrocycle: number,
    isDeloadMicrocycle: boolean
  ): number {
    // Deload microcycle: half the sets from the previous microcycle, minimum 1 set.
    if (isDeloadMicrocycle) {
      const baselineSets = this.calculateBaselineSetCount(
        microcycleIndex - 1,
        totalExercisesInMuscleGroupForMicrocycle,
        exerciseIndexInMuscleGroupForMicrocycle,
        false
      );
      return Math.max(1, Math.floor(baselineSets / 2));
    }

    // Total sets to distribute for this muscle group in this microcycle.
    // For now, add exactly +1 total set per microcycle per muscle group.
    const totalSets = 2 * totalExercisesInMuscleGroupForMicrocycle + microcycleIndex;

    // Distribute sets evenly, with earlier exercises getting extra sets from the remainder.
    const baseSetsPerExercise = Math.floor(totalSets / totalExercisesInMuscleGroupForMicrocycle);
    const remainder = totalSets % totalExercisesInMuscleGroupForMicrocycle;

    return exerciseIndexInMuscleGroupForMicrocycle < remainder
      ? baseSetsPerExercise + 1
      : baseSetsPerExercise;
  }
}
