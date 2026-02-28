import { DateService } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import type { WorkoutExerciseCTO } from '../../../ctos/workout/WorkoutExerciseCTO.js';
import { ExerciseRepRange } from '../../../documents/workout/WorkoutExercise.js';
import WorkoutExerciseService from '../Exercise/WorkoutExerciseService.js';
import type WorkoutMesocyclePlanContext from '../Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutSessionService from '../Session/WorkoutSessionService.js';
import WorkoutVolumePlanningService from '../util/VolumePlanning/WorkoutVolumePlanningService.js';

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
    targetRir: number | null;
    isDeloadMicrocycle: boolean;
  }): void {
    const mesocycle = context.mesocycle;
    const microcycle = context.microcyclesInOrder[microcycleIndex];

    if (!context.plannedSessionExerciseCTOs) {
      throw new Error(
        'WorkoutMesocyclePlanContext.plannedSessionExerciseCTOs is not initialized. This should be set during mesocycle planning.'
      );
    }
    if (!context.muscleGroupToExerciseCTOsMap) {
      throw new Error(
        'WorkoutMesocyclePlanContext.muscleGroupToExerciseCTOsMap is not initialized. This should be derived when the planned session exercise CTOs are set.'
      );
    }

    const sessionsToExerciseCTOsArray = context.plannedSessionExerciseCTOs;

    const setPlan = WorkoutVolumePlanningService.calculateSetPlanForMicrocycle(
      context,
      microcycleIndex,
      isDeloadMicrocycle
    );

    // Build list of non-rest day dates
    const nonRestDayDates: Date[] = [];
    let currentDate = new Date(microcycle.startDate);
    for (let day = 0; day < mesocycle.plannedMicrocycleLengthInDays; day++) {
      if (!mesocycle.plannedMicrocycleRestDays.includes(day)) {
        nonRestDayDates.push(new Date(currentDate));
      }
      currentDate = DateService.addDays(currentDate, 1);
    }

    // Distribute sessions across non-rest days chronologically. If there are
    // more sessions than non-rest days, the earliest days get extra sessions.
    const totalSessions = mesocycle.plannedSessionCountPerMicrocycle;
    const dayCount = nonRestDayDates.length;
    const basePerDay = Math.floor(totalSessions / dayCount);
    const remainder = totalSessions % dayCount;

    let sessionIndex = 0;
    for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
      const sessionsOnThisDay = basePerDay + (dayIndex < remainder ? 1 : 0);
      for (let s = 0; s < sessionsOnThisDay; s++) {
        const sessionExerciseList = sessionsToExerciseCTOsArray[sessionIndex] || [];

        WorkoutSessionService.generateSession({
          context,
          microcycleIndex,
          sessionIndex,
          sessionStartDate: nonRestDayDates[dayIndex],
          sessionExerciseList,
          targetRir,
          isDeloadMicrocycle,
          setPlan
        });

        sessionIndex++;
      }
    }
  }

  /**
   * Distributes exercises across sessions within a microcycle, by putting them into a consecutive
   * array of arrays structure. The embedded array is the list of exercises for that session.
   *
   * @param sessionCount The number of sessions to distribute exercises across.
   * @param exerciseCTOs The exercise CTOs to distribute.
   */
  static distributeExercisesAcrossSessions(
    sessionCount: number,
    exerciseCTOs: WorkoutExerciseCTO[]
  ): WorkoutExerciseCTO[][] {
    // Group exercises by their primary muscle group (use first one as main identifier, this might
    // need to be revisited later for multi-group exercises)
    const muscleGroupsMap = new Map<UUID, WorkoutExerciseCTO[]>();
    for (const cto of exerciseCTOs) {
      const muscleGroupId = cto.primaryMuscleGroups[0];
      const existingGroup = muscleGroupsMap.get(muscleGroupId);
      if (existingGroup) {
        existingGroup.push(cto);
      } else {
        muscleGroupsMap.set(muscleGroupId, [cto]);
      }
    }

    // 1. Calculate max fatigue for each muscle group to sort them initially
    const muscleGroupFatigueScores = new Map<UUID, number>();
    for (const [muscleGroupId, muscleGroupCTOs] of muscleGroupsMap.entries()) {
      const fatigueScores = muscleGroupCTOs.map((cto) =>
        WorkoutExerciseService.getFatigueScore(cto)
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
    const sessions: WorkoutExerciseCTO[][] = Array.from({ length: sessionCount }, () => []);
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
          const ctos = muscleGroupsMap.get(groupId);
          if (ctos && ctos.length > 0) {
            const fatigueScoresAmongExercises = ctos.map((cto) =>
              WorkoutExerciseService.getFatigueScore(cto)
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
              WorkoutExerciseService.getFatigueScore(b) - WorkoutExerciseService.getFatigueScore(a)
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
    const remainingExercises: WorkoutExerciseCTO[] = [];
    for (const group of muscleGroupsMap.values()) {
      remainingExercises.push(...group);
    }

    // Sort remaining by fatigue (High -> Low)
    remainingExercises.sort(
      (a, b) =>
        WorkoutExerciseService.getFatigueScore(b) - WorkoutExerciseService.getFatigueScore(a)
    );

    // Distribute round-robin
    let currentSessionIndex = 0;
    for (const cto of remainingExercises) {
      sessions[currentSessionIndex].push(cto);
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
        return order[a.repRange] - order[b.repRange];
      });
      session.length = 0;
      session.push(headliner, ...rest);
    }

    return sessions;
  }
}
