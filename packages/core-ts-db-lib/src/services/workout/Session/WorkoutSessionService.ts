import type { UUID } from 'crypto';
import type { CalibrationExercisePair } from '../../../documents/workout/WorkoutExerciseCalibration.js';
import type { WorkoutMesocycle } from '../../../documents/workout/WorkoutMesocycle.js';
import type { WorkoutMicrocycle } from '../../../documents/workout/WorkoutMicrocycle.js';
import type { WorkoutSession } from '../../../documents/workout/WorkoutSession.js';
import { WorkoutSessionSchema } from '../../../documents/workout/WorkoutSession.js';
import type { WorkoutSessionExercise } from '../../../documents/workout/WorkoutSessionExercise.js';
import { WorkoutSessionExerciseSchema } from '../../../documents/workout/WorkoutSessionExercise.js';
import type { WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import type WorkoutMesocyclePlanContext from '../Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutSetService from '../Set/WorkoutSetService.js';
import WorkoutSFRService from '../util/SFR/WorkoutSFRService.js';

/**
 * Describes why a session is locked and cannot be interacted with.
 */
export enum WorkoutSessionLockReason {
  MesocycleNotStarted = 'MesocycleNotStarted',
  PreviousMicrocycleNotCompleted = 'PreviousMicrocycleNotCompleted',
  PreviousSessionNotCompleted = 'PreviousSessionNotCompleted'
}

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
   * Returns the reason a session is locked, or `null` if the session is
   * unlocked and can be interacted with.
   *
   * A session is unlocked when:
   * - It has no microcycle (free-form session)
   * - It has no mesocycle (free-form microcycle)
   * - Its mesocycle has been started, the previous microcycle (if any) is
   *   completed, and the previous session in the same microcycle (if any)
   *   is complete.
   *
   * @param microcycle The session's parent microcycle, or null/undefined for free-form sessions.
   * @param mesocycle The session's parent mesocycle, or null/undefined for free-form microcycles.
   * @param previousMicrocycle The microcycle preceding the session's microcycle, or null/undefined if first.
   * @param previousSessionInMicrocycle The session before this one in the same microcycle, or null/undefined if first.
   */
  static getSessionLockReason(
    microcycle: WorkoutMicrocycle | null | undefined,
    mesocycle: WorkoutMesocycle | null | undefined,
    previousMicrocycle: WorkoutMicrocycle | null | undefined,
    previousSessionInMicrocycle: WorkoutSession | null | undefined
  ): WorkoutSessionLockReason | null {
    if (!microcycle) return null;
    if (!mesocycle) return null;
    if (mesocycle.startDate == null) return WorkoutSessionLockReason.MesocycleNotStarted;
    if (previousMicrocycle && previousMicrocycle.completedDate == null) {
      return WorkoutSessionLockReason.PreviousMicrocycleNotCompleted;
    }
    if (previousSessionInMicrocycle && !previousSessionInMicrocycle.complete) {
      return WorkoutSessionLockReason.PreviousSessionNotCompleted;
    }
    return null;
  }

  /**
   * Finds the in-progress session and the next-up session in a single pass.
   * - In-progress: complete === false, at least one set has actualReps != null
   * - Next-up: first complete === false session with no logged sets (after any in-progress)
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
    let inProgressSession: WorkoutSession | null = null;
    let nextUpSession: WorkoutSession | null = null;

    for (const session of sessions) {
      if (session.complete) continue;

      if (this.sessionHasLoggedSets(session, sessionExerciseMap, setMap)) {
        if (!inProgressSession) inProgressSession = session;
      } else {
        if (!nextUpSession) nextUpSession = session;
      }
      if (inProgressSession && nextUpSession) break;
    }

    return { inProgressSession, nextUpSession };
  }

  /**
   * Returns true if any set in the session has actualReps != null.
   * Traverses session → sessionExercises → sets via order arrays and map lookups.
   */
  private static sessionHasLoggedSets(
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

  /**
   * Generates a session and its associated exercises and sets.
   */
  static generateSession({
    context,
    microcycleIndex,
    sessionIndex,
    sessionStartDate,
    sessionExerciseList,
    targetRir,
    isDeloadMicrocycle,
    setPlan
  }: {
    context: WorkoutMesocyclePlanContext;
    microcycleIndex: number;
    sessionIndex: number;
    sessionStartDate: Date;
    sessionExerciseList: CalibrationExercisePair[];
    targetRir: number | null;
    isDeloadMicrocycle: boolean;
    setPlan: { exerciseIdToSetCount: Map<UUID, number>; recoveryExerciseIds: Set<UUID> };
  }): void {
    const mesocycle = context.mesocycle;
    const microcycle = context.microcyclesInOrder[microcycleIndex];

    const resolvedSetPlan = setPlan;

    // Create session
    const session = WorkoutSessionSchema.parse({
      userId: mesocycle.userId,
      workoutMicrocycleId: microcycle._id,
      title: `Microcycle ${microcycleIndex + 1} - Session ${sessionIndex + 1}`,
      startTime: sessionStartDate
    });

    // Create session exercise groupings and associated sets
    for (let exerciseIndex = 0; exerciseIndex < sessionExerciseList.length; exerciseIndex++) {
      const { calibration, exercise } = sessionExerciseList[exerciseIndex];

      const setCountFromPlan = resolvedSetPlan.exerciseIdToSetCount.get(exercise._id);
      if (setCountFromPlan == null) {
        throw new Error(
          `No set plan found for exercise ${exercise._id}, ${exercise.exerciseName} in microcycle ${microcycleIndex}`
        );
      }

      // Get equipment for weight calculations
      const equipment = context.equipmentMap.get(exercise.workoutEquipmentTypeId);
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

      const sessionExercise = WorkoutSessionExerciseSchema.parse({
        userId: mesocycle.userId,
        workoutSessionId: session._id,
        workoutExerciseId: exercise._id,
        isRecoveryExercise: resolvedSetPlan.recoveryExerciseIds.has(exercise._id)
      });

      WorkoutSetService.generateSetsForSessionExercise({
        context,
        exercise,
        calibration,
        session,
        sessionExercise,
        microcycleIndex,
        sessionIndex,
        setCount: setCountFromPlan,
        targetRir,
        isDeloadMicrocycle
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
}
