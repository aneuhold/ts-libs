import type { UUID } from 'crypto';
import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';
import type { WorkoutExercise } from '../../../documents/workout/WorkoutExercise.js';
import type {
  CalibrationExercisePair,
  WorkoutExerciseCalibration
} from '../../../documents/workout/WorkoutExerciseCalibration.js';
import type { WorkoutMesocycle } from '../../../documents/workout/WorkoutMesocycle.js';
import type { WorkoutMicrocycle } from '../../../documents/workout/WorkoutMicrocycle.js';
import type { WorkoutSession } from '../../../documents/workout/WorkoutSession.js';
import type { WorkoutSessionExercise } from '../../../documents/workout/WorkoutSessionExercise.js';
import type { WorkoutSet } from '../../../documents/workout/WorkoutSet.js';

/**
 * Central shared context for generating or updating a {@link WorkoutMesocycle}.
 *
 * This keeps the generation pipeline (Mesocycle -> Microcycle -> Session -> Set) from needing to
 * thread the same inputs (mesocycle config + document lookups + optional historical docs) through
 * every method.
 */
export default class WorkoutMesocyclePlanContext {
  /**
   * A constant for now that defines what the target RIR is for the first microcycle of every mesocycle,
   * regardless of anything else.
   */
  public readonly FIRST_MICROCYCLE_RIR = 4;

  public readonly calibrationMap: Map<UUID, WorkoutExerciseCalibration>;
  public readonly exerciseMap: Map<UUID, WorkoutExercise>;
  public readonly equipmentMap: Map<UUID, WorkoutEquipmentType>;
  public readonly sessionMap: Map<UUID, WorkoutSession>;
  public readonly sessionExerciseMap: Map<UUID, WorkoutSessionExercise>;

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
   * The array of sessions corresponding to the array of calibration exercise pairs, in order,
   * for that session.
   */
  public plannedSessionExercisePairs: CalibrationExercisePair[][] | undefined;
  /**
   * Stores the mesocycle's muscle-group-wide exercise ordering.
   *
   * This is used by session generation to distribute set progression evenly across
   * exercises that share a primary muscle group, regardless of which session they
   * ended up in.
   */
  public muscleGroupToExercisePairsMap: Map<UUID, CalibrationExercisePair[]> | undefined;
  public exerciseIdToSessionIndex: Map<UUID, number> | undefined;

  /**
   * Creates a new workout mesocycle planning context.
   */
  constructor(
    public mesocycle: WorkoutMesocycle,
    calibrations: WorkoutExerciseCalibration[],
    exercises: WorkoutExercise[],
    equipmentTypes: WorkoutEquipmentType[],
    public existingMicrocycles: WorkoutMicrocycle[] = [],
    public existingSessions: WorkoutSession[] = [],
    public existingSessionExercises: WorkoutSessionExercise[] = [],
    public existingSets: WorkoutSet[] = []
  ) {
    this.calibrationMap = new Map(calibrations.map((c) => [c._id, c]));
    this.exerciseMap = new Map(exercises.map((e) => [e._id, e]));
    this.equipmentMap = new Map(equipmentTypes.map((et) => [et._id, et]));
    this.sessionMap = new Map(existingSessions.map((s) => [s._id, s]));
    this.sessionExerciseMap = new Map(existingSessionExercises.map((s) => [s._id, s]));

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
   * Stores the planned session -> exercises structure for the mesocycle and derives
   * the muscle-group-wide ordering used for set progression.
   */
  public setPlannedSessionExercisePairs(
    plannedSessionExercisePairs: CalibrationExercisePair[][]
  ): void {
    this.plannedSessionExercisePairs = plannedSessionExercisePairs;
    this.buildSessionPairsMaps(plannedSessionExercisePairs);
  }

  /**
   * Builds and stores a map of primary muscle group -> ordered exercise pairs for the mesocycle plan.
   *
   * Also builds a map of exercise ID -> session index for use during session generation.
   *
   * The ordering is determined by flattening the planned sessions in order, then the exercises within
   * each session in order. This allows set progression to be distributed evenly across a muscle group
   * for the entire microcycle, even when exercises are split across sessions.
   */
  private buildSessionPairsMaps(sessionsToExercisePairs: CalibrationExercisePair[][]): void {
    const muscleGroupToPairsMap = new Map<UUID, CalibrationExercisePair[]>();
    const exerciseIdToSessionIndex = new Map<UUID, number>();

    for (let sessionIndex = 0; sessionIndex < sessionsToExercisePairs.length; sessionIndex++) {
      const sessionExercisePairs = sessionsToExercisePairs[sessionIndex];
      for (const exercisePair of sessionExercisePairs) {
        // Set the session index for this exercise as well
        exerciseIdToSessionIndex.set(exercisePair.exercise._id, sessionIndex);

        const primaryMuscleGroupId = exercisePair.exercise.primaryMuscleGroups[0];
        if (!primaryMuscleGroupId) {
          throw new Error(
            `Exercise ${exercisePair.exercise._id}, ${exercisePair.exercise.exerciseName} has no primary muscle group`
          );
        }

        const existing = muscleGroupToPairsMap.get(primaryMuscleGroupId);
        if (existing) {
          existing.push(exercisePair);
        } else {
          muscleGroupToPairsMap.set(primaryMuscleGroupId, [exercisePair]);
        }
      }
    }

    this.muscleGroupToExercisePairsMap = muscleGroupToPairsMap;
    this.exerciseIdToSessionIndex = exerciseIdToSessionIndex;
  }
}
