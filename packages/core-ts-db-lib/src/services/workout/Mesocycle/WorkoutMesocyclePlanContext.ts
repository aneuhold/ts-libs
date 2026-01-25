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

  public readonly microcyclesToCreate: WorkoutMicrocycle[] = [];
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
  }

  /**
   * Stores the planned session -> exercises structure for the mesocycle and derives
   * the muscle-group-wide ordering used for set progression.
   */
  public setPlannedSessionExercisePairs(
    plannedSessionExercisePairs: CalibrationExercisePair[][]
  ): void {
    this.plannedSessionExercisePairs = plannedSessionExercisePairs;
    this.addMuscleGroupToExercisePairsMap(plannedSessionExercisePairs);
  }

  /**
   * Builds and stores a map of primary muscle group -> ordered exercise pairs for the mesocycle plan.
   *
   * The ordering is determined by flattening the planned sessions in order, then the exercises within
   * each session in order. This allows set progression to be distributed evenly across a muscle group
   * for the entire microcycle, even when exercises are split across sessions.
   */
  private addMuscleGroupToExercisePairsMap(
    sessionsToExercisePairs: CalibrationExercisePair[][]
  ): void {
    const map = new Map<UUID, CalibrationExercisePair[]>();

    for (const sessionExercisePairs of sessionsToExercisePairs) {
      for (const exercisePair of sessionExercisePairs) {
        const primaryMuscleGroupId = exercisePair.exercise.primaryMuscleGroups[0];
        if (!primaryMuscleGroupId) {
          throw new Error(
            `Exercise ${exercisePair.exercise._id}, ${exercisePair.exercise.exerciseName} has no primary muscle group`
          );
        }

        const existing = map.get(primaryMuscleGroupId);
        if (existing) {
          existing.push(exercisePair);
        } else {
          map.set(primaryMuscleGroupId, [exercisePair]);
        }
      }
    }

    this.muscleGroupToExercisePairsMap = map;
  }
}
