import type { UUID } from 'crypto';
import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';
import type { WorkoutExercise } from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutExerciseCalibration } from '../../../documents/workout/WorkoutExerciseCalibration.js';
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
}
