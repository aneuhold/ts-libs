import { DateService } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';
import {
  ExerciseRepRange,
  type WorkoutExercise
} from '../../../documents/workout/WorkoutExercise.js';
import type {
  CalibrationExercisePair,
  WorkoutExerciseCalibration
} from '../../../documents/workout/WorkoutExerciseCalibration.js';
import { type WorkoutMesocycle } from '../../../documents/workout/WorkoutMesocycle.js';
import type { WorkoutMicrocycle } from '../../../documents/workout/WorkoutMicrocycle.js';
import type { WorkoutSession } from '../../../documents/workout/WorkoutSession.js';
import { WorkoutSessionSchema } from '../../../documents/workout/WorkoutSession.js';
import type { WorkoutSessionExercise } from '../../../documents/workout/WorkoutSessionExercise.js';
import { WorkoutSessionExerciseSchema } from '../../../documents/workout/WorkoutSessionExercise.js';
import type { WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import { WorkoutSetSchema } from '../../../documents/workout/WorkoutSet.js';
import WorkoutEquipmentTypeService from '../EquipmentType/WorkoutEquipmentTypeService.js';
import WorkoutExerciseService from '../Exercise/WorkoutExerciseService.js';

/**
 * A service for handling operations related to {@link WorkoutMicrocycle}s.
 */
export default class WorkoutMicrocycleService {
  /**
   * Generates sessions for a specific microcycle.
   *
   * @param mesocycle
   * @param microcycle
   * @param microcycleIndex
   * @param targetRir
   * @param firstMicrocycleRir
   * @param isDeloadMicrocycle
   * @param calibrationMap
   * @param exerciseMap
   * @param equipmentMap
   */
  static generateSessionsForMicrocycle(
    mesocycle: WorkoutMesocycle,
    microcycle: WorkoutMicrocycle,
    microcycleIndex: number,
    targetRir: number,
    firstMicrocycleRir: number,
    isDeloadMicrocycle: boolean,
    calibrationMap: Map<UUID, WorkoutExerciseCalibration>,
    exerciseMap: Map<UUID, WorkoutExercise>,
    equipmentMap: Map<UUID, WorkoutEquipmentType>
  ): {
    sessions: WorkoutSession[];
    sessionExercises: WorkoutSessionExercise[];
    sets: WorkoutSet[];
  } {
    const sessions: WorkoutSession[] = [];
    const sessionExercises: WorkoutSessionExercise[] = [];
    const sets: WorkoutSet[] = [];

    // Distribute exercises across sessions
    const exercisesPerSession = this.distributeExercisesAcrossSessions(
      mesocycle.plannedSessionCountPerMicrocycle,
      calibrationMap,
      exerciseMap
    );

    let currentSessionDate = new Date(microcycle.startDate);
    let sessionIndex = 0;

    for (let day = 0; day < mesocycle.plannedMicrocycleLengthInDays; day++) {
      // Skip rest days
      if (mesocycle.plannedMicrocycleRestDays.includes(day)) {
        currentSessionDate = DateService.addDays(currentSessionDate, 1);
        continue;
      }

      // Stop if we've created all planned sessions
      if (sessionIndex >= mesocycle.plannedSessionCountPerMicrocycle) {
        break;
      }

      const sessionExerciseList = exercisesPerSession[sessionIndex] || [];

      // Create session
      const session = WorkoutSessionSchema.parse({
        userId: mesocycle.userId,
        workoutMicrocycleId: microcycle._id,
        title: `Microcycle ${microcycleIndex + 1} - Session ${sessionIndex + 1}`,
        startTime: new Date(currentSessionDate)
      });

      // Add session to microcycle's session order
      microcycle.sessionOrder.push(session._id);

      // Create session exercise groupings and associated sets
      for (let exerciseIndex = 0; exerciseIndex < sessionExerciseList.length; exerciseIndex++) {
        const { calibration, exercise } = sessionExerciseList[exerciseIndex];

        const sessionExercise = WorkoutSessionExerciseSchema.parse({
          userId: mesocycle.userId,
          workoutSessionId: session._id,
          workoutExerciseId: exercise._id
        });

        session.sessionExerciseOrder.push(sessionExercise._id);

        // Calculate number of sets for this exercise in this microcycle
        const setCount = this.calculateSetCount(
          microcycleIndex,
          sessionExerciseList.length,
          exerciseIndex,
          isDeloadMicrocycle
        );

        // Get rep range for this exercise
        const repRange = WorkoutExerciseService.getRepRangeValues(exercise.repRange);

        // Get equipment for weight calculations
        const equipment = equipmentMap.get(exercise.workoutEquipmentTypeId);
        if (!equipment) {
          throw new Error(
            `Equipment type not found for exercise ${exercise._id}, ${exercise.exerciseName}`
          );
        }
        if (!equipment.weightOptions || equipment.weightOptions.length === 0) {
          throw new Error(
            `No weight options defined for equipment type ${equipment._id}, ${equipment.title}`
          );
        }

        // Calculate progressed targets using WorkoutExerciseService
        const { targetWeight: firstSetWeight, targetReps: firstSetReps } =
          WorkoutExerciseService.calculateProgressedTargets({
            exercise,
            calibration,
            equipment,
            microcycleIndex,
            firstMicrocycleRir
          });

        // Create sets
        let currentWeight = firstSetWeight;
        let currentReps = firstSetReps;

        for (let setIndex = 0; setIndex < setCount; setIndex++) {
          // Ideally, drop 2 reps per set within the session (19 -> 17 -> 15, etc.)
          // But if that would go below the min reps, keep it at min reps.
          if (currentReps - 2 < repRange.min && setIndex > 0) {
            // Reduce weight by 2% using the same technique as progression
            const twoPercentDecrease = currentWeight / 1.02;
            const reducedWeight = WorkoutEquipmentTypeService.findNearestWeight(
              equipment,
              twoPercentDecrease,
              'down'
            );
            if (reducedWeight !== null) {
              currentWeight = reducedWeight;
            } else if (currentReps - 2 > 5) {
              // If we can't reduce weight, but we can reduce reps without going too low,
              // then do that.
              currentReps = currentReps - 2;
            }
          } else if (setIndex > 0) {
            currentReps = currentReps - 2;
          }

          const plannedWeight = currentWeight;

          // Apply deload modifications
          let deloadReps = currentReps;
          let deloadWeight = plannedWeight;
          if (isDeloadMicrocycle) {
            deloadReps = Math.floor(currentReps / 2);
            // First half of deload microcycle: same weight, half reps/sets
            // Second half: half weight too
            if (sessionIndex >= Math.floor(mesocycle.plannedSessionCountPerMicrocycle / 2)) {
              deloadWeight = Math.floor(plannedWeight / 2);
            }
          }

          const workoutSet = WorkoutSetSchema.parse({
            userId: mesocycle.userId,
            workoutExerciseId: exercise._id,
            workoutSessionId: session._id,
            workoutSessionExerciseId: sessionExercise._id,
            plannedReps: isDeloadMicrocycle ? deloadReps : currentReps,
            plannedWeight: isDeloadMicrocycle ? deloadWeight : plannedWeight,
            plannedRir: targetRir,
            exerciseProperties: calibration.exerciseProperties
          });

          sessionExercise.setOrder.push(workoutSet._id);
          sets.push(workoutSet);
        }

        sessionExercises.push(sessionExercise);
      }

      sessions.push(session);
      sessionIndex++;
      currentSessionDate = DateService.addDays(currentSessionDate, 1);
    }

    return { sessions, sessionExercises, sets };
  }

  /**
   * Distributes exercises across sessions within a microcycle, by putting them into a consecutive
   * array of arrays structure. The embedded array is the list of exercises for that session.
   *
   * @param sessionCount The number of sessions to distribute exercises across.
   * @param calibrationMap The map of calibration documents.
   * @param exerciseMap The map of exercise documents.
   */
  private static distributeExercisesAcrossSessions(
    sessionCount: number,
    calibrationMap: Map<UUID, WorkoutExerciseCalibration>,
    exerciseMap: Map<UUID, WorkoutExercise>
  ): CalibrationExercisePair[][] {
    // Build calibration-exercise pairs from the provided maps
    const validExercises: CalibrationExercisePair[] = [];
    for (const calibration of calibrationMap.values()) {
      const exercise = exerciseMap.get(calibration.workoutExerciseId);
      if (!exercise) {
        throw new Error(
          `Exercise ${calibration.workoutExerciseId} not found for calibration ${calibration._id}`
        );
      }
      validExercises.push({ calibration, exercise });
    }

    // Group exercises by their primary muscle group (use first one as main identifier, this might
    // need to be revisited later for multi-group exercises)
    const muscleGroupsMap = new Map<UUID, CalibrationExercisePair[]>();
    for (const exercisePair of validExercises) {
      const muscleGroupId = exercisePair.exercise.primaryMuscleGroups[0];
      const existingGroup = muscleGroupsMap.get(muscleGroupId);
      if (existingGroup) {
        existingGroup.push(exercisePair);
      } else {
        muscleGroupsMap.set(muscleGroupId, [exercisePair]);
      }
    }

    // 1. Calculate max fatigue for each muscle group to sort them initially
    const muscleGroupFatigueScores = new Map<UUID, number>();
    for (const [muscleGroupId, muscleGroupExercises] of muscleGroupsMap.entries()) {
      const fatigueScores = muscleGroupExercises.map((pair) =>
        WorkoutExerciseService.getFatigueScore(pair.exercise)
      );
      const maxFatigue = Math.max(...fatigueScores);
      muscleGroupFatigueScores.set(muscleGroupId, maxFatigue);
    }

    // 2. Sort muscle groups by their max fatigue (Desc) so hardest exercises for a group get assigned first
    const sortedMuscleGroupIds = [...muscleGroupsMap.keys()].sort((a, b) => {
      const fatigueA = muscleGroupFatigueScores.get(a) || 0;
      const fatigueB = muscleGroupFatigueScores.get(b) || 0;
      return fatigueB - fatigueA;
    });

    // Prepare sessions array (so we can push exercises into each empty array)
    const sessions: CalibrationExercisePair[][] = Array.from({ length: sessionCount }, () => []);
    const usedStarterGroups = new Set<UUID>();

    // 3. Assign Headliners (Priority 1 & 2)
    // Iterate sessions and pick a starter exercise
    for (let sessionIndex = 0; sessionIndex < sessionCount; sessionIndex++) {
      let candidateMuscleGroupId: UUID | undefined;

      // Try to find a group that hasn't started a session yet (Priority 1)
      for (const groupId of sortedMuscleGroupIds) {
        if (!usedStarterGroups.has(groupId)) {
          candidateMuscleGroupId = groupId;
          break;
        }
      }

      // If no unused group available/has exercises, pick any group with highest fatigue available (Priority 2 fallback)
      if (!candidateMuscleGroupId) {
        let maxFatigue = -1;
        for (const groupId of sortedMuscleGroupIds) {
          const exercisePairs = muscleGroupsMap.get(groupId);
          if (exercisePairs && exercisePairs.length > 0) {
            const fatigueScoresAmongExercises = exercisePairs.map((pair) =>
              WorkoutExerciseService.getFatigueScore(pair.exercise)
            );
            const groupMax = Math.max(...fatigueScoresAmongExercises);
            if (groupMax > maxFatigue) {
              maxFatigue = groupMax;
              candidateMuscleGroupId = groupId;
            }
          }
        }
      }

      if (candidateMuscleGroupId) {
        const group = muscleGroupsMap.get(candidateMuscleGroupId);
        if (group && group.length > 0) {
          // Pick highest fatigue exercise in this group to be the headliner
          group.sort(
            (a, b) =>
              WorkoutExerciseService.getFatigueScore(b.exercise) -
              WorkoutExerciseService.getFatigueScore(a.exercise)
          );
          const headliner = group.shift();
          if (headliner) {
            sessions[sessionIndex].push(headliner);
            usedStarterGroups.add(candidateMuscleGroupId);
          }
        }
      }
    }

    // 4. Distribute Remainder (Priority 2 continued)
    const remainingExercises: CalibrationExercisePair[] = [];
    for (const group of muscleGroupsMap.values()) {
      remainingExercises.push(...group);
    }

    // Sort remaining by fatigue (High -> Low)
    remainingExercises.sort(
      (a, b) =>
        WorkoutExerciseService.getFatigueScore(b.exercise) -
        WorkoutExerciseService.getFatigueScore(a.exercise)
    );

    // Distribute round-robin
    let currentSessionIndex = 0;
    for (const pair of remainingExercises) {
      sessions[currentSessionIndex].push(pair);
      currentSessionIndex = (currentSessionIndex + 1) % sessionCount;
    }

    // 5. Sort within session (Priority 3)
    // Headliner stays first (Index 0). Rest sorted by Rep Range (Heavy -> Med -> Light)
    for (const session of sessions) {
      if (session.length <= 1) continue;
      const [headliner, ...rest] = session;
      rest.sort((a, b) => {
        const order = {
          [ExerciseRepRange.Heavy]: 0,
          [ExerciseRepRange.Medium]: 1,
          [ExerciseRepRange.Light]: 2
        };
        return order[a.exercise.repRange] - order[b.exercise.repRange];
      });
      session.length = 0;
      session.push(headliner, ...rest);
    }

    return sessions;
  }

  /**
   * Calculates the number of sets for an exercise based on microcycle progression.
   *
   * Formula: Start at 2 sets per exercise, add 1 total set per microcycle distributed
   * across all exercises (earlier exercises get priority).
   *
   * - Microcycle 1: Exercise 1 gets 2 sets, Exercise 2 gets 2 sets, etc.
   * - Microcycle 2: Exercise 1 gets 3 sets (gets the +1), Exercise 2 gets 2 sets
   * - Microcycle 3 (2 exercises): Exercise 1 gets 3 sets, Exercise 2 gets 3 sets (both get +1)
   *
   * @param microcycleIndex The current microcycle index (0-based).
   * @param totalExercisesInSession Total number of exercises for this muscle group in this session.
   * @param exerciseIndexInSession The index of this exercise within the session (0-based) for
   * the current muscle group.
   * @param isDeloadMicrocycle Whether this is a deload microcycle.
   */
  private static calculateSetCount(
    microcycleIndex: number,
    totalExercisesInSession: number,
    exerciseIndexInSession: number,
    isDeloadMicrocycle: boolean
  ): number {
    // Deload microcycle: half the sets from the previous microcycle, minimum 1 set
    if (isDeloadMicrocycle) {
      const baselineSets = this.calculateSetCount(
        microcycleIndex - 1,
        totalExercisesInSession,
        exerciseIndexInSession,
        false
      );
      return Math.max(1, Math.floor(baselineSets / 2));
    }

    // Total sets to distribute = (2 * number of exercises) + microcycle index
    const totalSets = 2 * totalExercisesInSession + microcycleIndex;

    // Distribute sets evenly, with earlier exercises getting extra sets from remainder
    const baseSetsPerExercise = Math.floor(totalSets / totalExercisesInSession);
    const remainder = totalSets % totalExercisesInSession;

    // If this exercise's index is less than the remainder, it gets an extra set
    return exerciseIndexInSession < remainder ? baseSetsPerExercise + 1 : baseSetsPerExercise;
  }
}
