import type { UUID } from 'crypto';
import type { WorkoutExerciseCTO } from '../../../ctos/workout/WorkoutExerciseCTO.js';
import type {
  WorkoutMuscleGroupVolumeCTO,
  WorkoutVolumeLandmarkEstimate
} from '../../../ctos/workout/WorkoutMuscleGroupVolumeCTO.js';
import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';
import type { WorkoutExercise } from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutMesocycle } from '../../../documents/workout/WorkoutMesocycle.js';
import { CycleType } from '../../../documents/workout/WorkoutMesocycle.js';
import type { WorkoutMicrocycle } from '../../../documents/workout/WorkoutMicrocycle.js';
import type { WorkoutSession } from '../../../documents/workout/WorkoutSession.js';
import type { WorkoutSessionExercise } from '../../../documents/workout/WorkoutSessionExercise.js';
import type { WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import WorkoutVolumePlanningService from '../util/VolumePlanning/WorkoutVolumePlanningService.js';

/**
 * Central shared context for generating or updating a {@link WorkoutMesocycle}.
 *
 * This keeps the generation pipeline (Mesocycle -> Microcycle -> Session -> Set) from needing to
 * thread the same inputs (mesocycle config + document lookups + optional historical docs) through
 * every method.
 */
export default class WorkoutMesocyclePlanContext {
  /**
   * The target RIR for the first microcycle of the mesocycle. Varies by cycle
   * type: MuscleGain starts at 4, Cut starts at 3, Resensitization stays at 3.
   */
  public readonly firstMicrocycleRir: number;

  /**
   * Number of microcycles between each baseline set addition.
   * MuscleGain = 1 (every microcycle), Cut = 2 (every other), Resensitization = 0 (never).
   */
  public readonly progressionInterval: number;

  /**
   * Whether this mesocycle type skips the deload microcycle. True for
   * Resensitization cycles.
   */
  public readonly skipDeload: boolean;

  /**
   * Number of accumulation (non-deload) microcycles in this mesocycle.
   * Equal to the total planned count when deload is skipped, or total minus one otherwise.
   */
  public readonly accumulationMicrocycleCount: number;

  public readonly exerciseMap: Map<UUID, WorkoutExercise>;
  public readonly equipmentMap: Map<UUID, WorkoutEquipmentType>;
  public readonly sessionMap: Map<UUID, WorkoutSession>;
  public readonly sessionExerciseMap: Map<UUID, WorkoutSessionExercise>;
  public readonly setMap: Map<UUID, WorkoutSet>;

  public readonly microcyclesToCreate: WorkoutMicrocycle[] = [];
  /**
   * All microcycles for this mesocycle in chronological order.
   *
   * This includes any existing microcycles (filtered to the target mesocycle) and
   * all newly generated microcycles.
   */
  public readonly microcyclesInOrder: WorkoutMicrocycle[] = [];
  public readonly sessionsToCreate: WorkoutSession[] = [];
  public readonly sessionExercisesToCreate: WorkoutSessionExercise[] = [];
  public readonly setsToCreate: WorkoutSet[] = [];

  /**
   * The array of sessions corresponding to the array of exercise CTOs, in order,
   * for that session.
   */
  public plannedSessionExerciseCTOs: WorkoutExerciseCTO[][] | undefined;
  /**
   * Stores the mesocycle's muscle-group-wide exercise ordering.
   *
   * This is used by session generation to distribute set progression evenly across
   * exercises that share a primary muscle group, regardless of which session they
   * ended up in.
   */
  public muscleGroupToExerciseCTOsMap: Map<UUID, WorkoutExerciseCTO[]> | undefined;
  /**
   * Maps muscle group ID to its estimated volume landmarks (MEV, MRV, MAV).
   * Populated from WorkoutMuscleGroupVolumeCTOs when provided.
   */
  public muscleGroupToVolumeLandmarkMap: Map<UUID, WorkoutVolumeLandmarkEstimate>;
  public exerciseIdToSessionIndex: Map<UUID, number> | undefined;

  /**
   * Creates a new workout mesocycle planning context.
   */
  constructor(
    public mesocycle: WorkoutMesocycle,
    exerciseCTOs: WorkoutExerciseCTO[],
    volumeCTOs: WorkoutMuscleGroupVolumeCTO[] = [],
    public existingMicrocycles: WorkoutMicrocycle[] = [],
    public existingSessions: WorkoutSession[] = [],
    public existingSessionExercises: WorkoutSessionExercise[] = [],
    public existingSets: WorkoutSet[] = []
  ) {
    // Set cycle-type-specific planning parameters
    const { cycleType } = mesocycle;
    if (cycleType === CycleType.Cut) {
      this.firstMicrocycleRir = 3;
      this.progressionInterval = 2;
      this.skipDeload = false;
    } else if (cycleType === CycleType.Resensitization) {
      this.firstMicrocycleRir = 3;
      this.progressionInterval = 0;
      this.skipDeload = true;
    } else {
      this.firstMicrocycleRir = 4;
      this.progressionInterval = 1;
      this.skipDeload = false;
    }

    const totalMicrocycles = mesocycle.plannedMicrocycleCount ?? 6;
    this.accumulationMicrocycleCount = this.skipDeload ? totalMicrocycles : totalMicrocycles - 1;

    // Build volume landmark estimates from historical CTOs
    this.muscleGroupToVolumeLandmarkMap = new Map(
      volumeCTOs.map((cto) => [cto._id, WorkoutVolumePlanningService.estimateVolumeLandmarks(cto)])
    );

    // Derive exercise map from CTOs
    this.exerciseMap = new Map(exerciseCTOs.map((cto) => [cto._id, cto]));

    // Derive equipment map from CTOs
    this.equipmentMap = new Map(
      exerciseCTOs.map((cto) => [cto.equipmentType._id, cto.equipmentType])
    );

    this.sessionMap = new Map(existingSessions.map((s) => [s._id, s]));
    this.sessionExerciseMap = new Map(existingSessionExercises.map((s) => [s._id, s]));
    this.setMap = new Map(existingSets.map((s) => [s._id, s]));

    const existingMicrocyclesForMesocycle = existingMicrocycles
      .filter((m) => m.workoutMesocycleId === mesocycle._id)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    this.microcyclesInOrder.push(...existingMicrocyclesForMesocycle);
  }

  /**
   * Adds a microcycle to the list of microcycles to create and the overall chronological list.
   */
  public addMicrocycle(toCreate: WorkoutMicrocycle): void {
    this.microcyclesToCreate.push(toCreate);
    this.microcyclesInOrder.push(toCreate);
  }

  /**
   * Adds a session to the context and updates internal maps.
   */
  public addSession(session: WorkoutSession): void {
    this.sessionsToCreate.push(session);
    this.sessionMap.set(session._id, session);
  }

  /**
   * Adds a session exercise to the context and updates internal maps.
   */
  public addSessionExercise(sessionExercise: WorkoutSessionExercise): void {
    this.sessionExercisesToCreate.push(sessionExercise);
    this.sessionExerciseMap.set(sessionExercise._id, sessionExercise);
  }

  /**
   * Adds sets to the context and updates the set map for O(1) lookup.
   */
  public addSets(sets: WorkoutSet[]): void {
    this.setsToCreate.push(...sets);
    for (const set of sets) {
      this.setMap.set(set._id, set);
    }
  }

  /**
   * Stores the planned session -> exercises structure for the mesocycle and derives
   * the muscle-group-wide ordering used for set progression.
   */
  public setPlannedSessionExerciseCTOs(plannedSessionExerciseCTOs: WorkoutExerciseCTO[][]): void {
    this.plannedSessionExerciseCTOs = plannedSessionExerciseCTOs;
    this.buildSessionCTOMaps(plannedSessionExerciseCTOs);
  }

  /**
   * Builds and stores a map of primary muscle group -> ordered exercise CTOs for the mesocycle plan.
   *
   * Also builds a map of exercise ID -> session index for use during session generation.
   *
   * The ordering is determined by flattening the planned sessions in order, then the exercises within
   * each session in order. This allows set progression to be distributed evenly across a muscle group
   * for the entire microcycle, even when exercises are split across sessions.
   */
  private buildSessionCTOMaps(sessionsToCTOs: WorkoutExerciseCTO[][]): void {
    const muscleGroupToCTOsMap = new Map<UUID, WorkoutExerciseCTO[]>();
    const exerciseIdToSessionIndex = new Map<UUID, number>();

    for (let sessionIndex = 0; sessionIndex < sessionsToCTOs.length; sessionIndex++) {
      const sessionCTOs = sessionsToCTOs[sessionIndex];
      for (const cto of sessionCTOs) {
        exerciseIdToSessionIndex.set(cto._id, sessionIndex);

        const primaryMuscleGroupId = cto.primaryMuscleGroups[0];
        if (!primaryMuscleGroupId) {
          throw new Error(`Exercise ${cto._id}, ${cto.exerciseName} has no primary muscle group`);
        }

        const existing = muscleGroupToCTOsMap.get(primaryMuscleGroupId);
        if (existing) {
          existing.push(cto);
        } else {
          muscleGroupToCTOsMap.set(primaryMuscleGroupId, [cto]);
        }
      }
    }

    this.muscleGroupToExerciseCTOsMap = muscleGroupToCTOsMap;
    this.exerciseIdToSessionIndex = exerciseIdToSessionIndex;
  }
}
