import type { UUID } from 'crypto';
import type { WorkoutExerciseCTO } from '../../../ctos/workout/WorkoutExerciseCTO.js';
import type { WorkoutSession } from '../../../documents/workout/WorkoutSession.js';
import { WorkoutSessionSchema } from '../../../documents/workout/WorkoutSession.js';
import type { WorkoutSessionExercise } from '../../../documents/workout/WorkoutSessionExercise.js';
import { WorkoutSessionExerciseSchema } from '../../../documents/workout/WorkoutSessionExercise.js';
import type { WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import type WorkoutMesocyclePlanContext from '../Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutSetService from '../Set/WorkoutSet.service.js';
import WorkoutSFRService from '../util/SFR/WorkoutSFR.service.js';

/**
 * A service for handling operations related to {@link WorkoutSession}s.
 *
 * SCOPE: Session-level operations (calculating totals, managing session generation)
 *
 * RESPONSIBILITIES:
 * - Calculate session-level RSM/Fatigue totals
 * - Generate workout sessions with exercises and sets
 *
 * RELATED SERVICES:
 * - {@link WorkoutVolumePlanningService} - Provides set count plans for session generation
 * - {@link WorkoutSetService} - Generates individual sets within sessions
 * - {@link WorkoutSFRService} - Underlying calculations for RSM/Fatigue
 */
export default class WorkoutSessionService {
  /**
   * Calculates the total Raw Stimulus Magnitude for a session.
   */
  static getRsmTotal(session: WorkoutSession): number | null {
    return WorkoutSFRService.getRsmTotal(session.rsm);
  }

  /**
   * Calculates the total fatigue score for a session.
   */
  static getFatigueTotal(session: WorkoutSession): number | null {
    return WorkoutSFRService.getFatigueTotal(session.fatigue);
  }

  /**
   * Calculates the Stimulus to Fatigue Ratio (SFR) for a session.
   */
  static getSFR(session: WorkoutSession): number | null {
    return WorkoutSFRService.getSFR(session.rsm, session.fatigue);
  }

  /**
   * Finds the in-progress session and the next-up session in a single pass.
   * At most one of them is returned, since nothing is next up while a session
   * is in progress.
   * - In-progress: first complete === false session where at least one set has actualReps != null
   * - Next-up: first complete === false session with no logged sets, when no session is in progress
   *
   * Sessions should be in microcycle order (as returned by getAssociatedDocsForMesocycle).
   * Only checks sets for incomplete sessions, skipping completed ones entirely.
   *
   * @param sessions Ordered sessions for the mesocycle.
   * @param sessionExerciseMap Map of session exercise ID to WorkoutSessionExercise.
   * @param setMap Map of set ID to WorkoutSet.
   */
  static getActiveAndNextSessions(
    sessions: WorkoutSession[],
    sessionExerciseMap: Map<UUID, WorkoutSessionExercise>,
    setMap: Map<UUID, WorkoutSet>
  ): { inProgressSession: WorkoutSession | null; nextUpSession: WorkoutSession | null } {
    let nextUpSession: WorkoutSession | null = null;

    for (const session of sessions) {
      if (session.complete) continue;

      if (this.#sessionHasLoggedSets(session, sessionExerciseMap, setMap)) {
        return { inProgressSession: session, nextUpSession: null };
      }
      if (!nextUpSession) nextUpSession = session;
    }

    return { inProgressSession: null, nextUpSession };
  }

  /**
   * Generates a session and its associated exercises and sets.
   */
  static generateSession({
    context,
    microcycleIndex,
    sessionIndex,
    sessionStartDate,
    sessionExerciseList,
    setPlan
  }: {
    context: WorkoutMesocyclePlanContext;
    microcycleIndex: number;
    sessionIndex: number;
    sessionStartDate: Date;
    sessionExerciseList: WorkoutExerciseCTO[];
    setPlan: { exerciseIdToSetCount: Map<UUID, number>; recoveryExerciseIds: Set<UUID> };
  }): void {
    const mesocycle = context.mesocycle;
    const { microcycle } = context.microcyclesInOrder[microcycleIndex];

    const resolvedSetPlan = setPlan;
    const microcycleLabel = context.isDeloadMicrocycle(microcycleIndex)
      ? 'Deload'
      : `Microcycle ${microcycleIndex + 1}`;

    // Create session
    const session = WorkoutSessionSchema.parse({
      userId: mesocycle.userId,
      workoutMicrocycleId: microcycle._id,
      title: `${microcycleLabel} - Session ${sessionIndex + 1}`,
      startTime: sessionStartDate
    });

    // Create session exercise groupings and associated sets
    for (let exerciseIndex = 0; exerciseIndex < sessionExerciseList.length; exerciseIndex++) {
      const exerciseCTO = sessionExerciseList[exerciseIndex];

      const setCountFromPlan = resolvedSetPlan.exerciseIdToSetCount.get(exerciseCTO._id);
      if (setCountFromPlan == null) {
        throw new Error(
          `No set plan found for exercise ${exerciseCTO._id}, ${exerciseCTO.exerciseName} in microcycle ${microcycleIndex}`
        );
      }

      const sessionExercise = WorkoutSessionExerciseSchema.parse({
        userId: mesocycle.userId,
        workoutSessionId: session._id,
        workoutExerciseId: exerciseCTO._id,
        isRecoveryExercise: resolvedSetPlan.recoveryExerciseIds.has(exerciseCTO._id)
      });

      WorkoutSetService.generateSetsForSessionExercise({
        context,
        exerciseCTO,
        session,
        sessionExercise,
        microcycleIndex,
        sessionIndex,
        setCount: setCountFromPlan
      });

      const setsForThisExercise = context.setsToCreate.slice(-setCountFromPlan);

      sessionExercise.setOrder.push(...setsForThisExercise.map((s) => s._id));
      session.sessionExerciseOrder.push(sessionExercise._id);
      context.addSessionExercise(sessionExercise);
    }

    // Add session to microcycle's session order and context
    microcycle.sessionOrder.push(session._id);
    context.addSession(session);
  }

  /**
   * Returns true if any set in the session has actualReps != null.
   * Traverses session -> sessionExercises -> sets via order arrays and map lookups.
   */
  static #sessionHasLoggedSets(
    session: WorkoutSession,
    sessionExerciseMap: Map<UUID, WorkoutSessionExercise>,
    setMap: Map<UUID, WorkoutSet>
  ): boolean {
    for (const seId of session.sessionExerciseOrder) {
      const se = sessionExerciseMap.get(seId);
      if (!se) continue;
      for (const setId of se.setOrder) {
        const set = setMap.get(setId);
        if (set?.actualReps != null) return true;
      }
    }
    return false;
  }
}
