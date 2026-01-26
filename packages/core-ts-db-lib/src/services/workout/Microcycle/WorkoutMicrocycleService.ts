import { DateService } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import {
  ExerciseRepRange,
  type WorkoutExercise
} from '../../../documents/workout/WorkoutExercise.js';
import type {
  CalibrationExercisePair,
  WorkoutExerciseCalibration
} from '../../../documents/workout/WorkoutExerciseCalibration.js';
import WorkoutExerciseService from '../Exercise/WorkoutExerciseService.js';
import type WorkoutMesocyclePlanContext from '../Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutSessionService from '../Session/WorkoutSessionService.js';

/**
 * A service for handling operations related to {@link WorkoutMicrocycle}s.
 */
export default class WorkoutMicrocycleService {
  /**
   * Generates sessions for a specific microcycle.
   */
  static generateSessionsForMicrocycle({
    context,
    microcycleIndex,
    targetRir,
    isDeloadMicrocycle
  }: {
    context: WorkoutMesocyclePlanContext;
    microcycleIndex: number;
    targetRir: number;
    isDeloadMicrocycle: boolean;
  }): void {
    const mesocycle = context.mesocycle;
    const microcycle = context.microcyclesToCreate[microcycleIndex];

    if (!context.plannedSessionExercisePairs) {
      throw new Error(
        'WorkoutMesocyclePlanContext.plannedSessionExercisePairs is not initialized. This should be set during mesocycle planning.'
      );
    }
    if (!context.muscleGroupToExercisePairsMap) {
      throw new Error(
        'WorkoutMesocyclePlanContext.muscleGroupToExercisePairsMap is not initialized. This should be derived when the planned session exercise pairs are set.'
      );
    }

    const sessionsToExerciseSessionsArray = context.plannedSessionExercisePairs;

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

      const sessionExerciseList = sessionsToExerciseSessionsArray[sessionIndex] || [];

      WorkoutSessionService.generateSession({
        context,
        microcycleIndex,
        sessionIndex,
        sessionStartDate: currentSessionDate,
        sessionExerciseList,
        targetRir,
        isDeloadMicrocycle
      });

      sessionIndex++;
      currentSessionDate = DateService.addDays(currentSessionDate, 1);
    }
  }

  /**
   * Distributes exercises across sessions within a microcycle, by putting them into a consecutive
   * array of arrays structure. The embedded array is the list of exercises for that session.
   *
   * @param sessionCount The number of sessions to distribute exercises across.
   * @param calibrationMap The map of calibration documents.
   * @param exerciseMap The map of exercise documents.
   */
  static distributeExercisesAcrossSessions(
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
}
