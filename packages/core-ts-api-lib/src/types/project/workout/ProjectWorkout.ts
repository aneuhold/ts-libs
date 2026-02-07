import type {
  CycleType,
  WorkoutEquipmentType,
  WorkoutExercise,
  WorkoutExerciseCalibration,
  WorkoutMesocycle,
  WorkoutMicrocycle,
  WorkoutMuscleGroup,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet
} from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';

/**
 * Base options for getting documents.
 */
interface GetOptionsBase<T> {
  /**
   * Get all documents of this type if true.
   */
  all?: boolean;
  /**
   * Filter documents by matching partial properties.
   * This allows filtering by any document field.
   */
  objectFilter?: Partial<T>;
}

/**
 * Options for interacting with the workout app via the primary endpoint.
 */
export interface ProjectWorkoutPrimaryEndpointOptions {
  get?: {
    /**
     * Get mesocycles with optional filters.
     */
    mesocycles?: GetOptionsBase<WorkoutMesocycle> & {
      /**
       * Get only the active (uncompleted) mesocycle.
       */
      active?: boolean;
      /**
       * Get only completed mesocycles.
       */
      completed?: boolean;
      /**
       * Filter by specific cycle types.
       */
      cycleTypes?: CycleType[];
      /**
       * Get mesocycles completed after this date.
       */
      completedAfter?: Date;
      /**
       * Get mesocycles completed before this date.
       */
      completedBefore?: Date;
    };
    /**
     * Get microcycles with optional filters.
     */
    microcycles?: GetOptionsBase<WorkoutMicrocycle> & {
      /**
       * Get microcycles starting on or after this date.
       */
      startDateFrom?: Date;
      /**
       * Get microcycles starting on or before this date.
       */
      startDateTo?: Date;
      /**
       * Get microcycles ending on or after this date.
       */
      endDateFrom?: Date;
      /**
       * Get microcycles ending on or before this date.
       */
      endDateTo?: Date;
    };
    /**
     * Get sessions with optional filters.
     */
    sessions?: GetOptionsBase<WorkoutSession> & {
      /**
       * Get only completed sessions.
       */
      completed?: boolean;
      /**
       * Get only incomplete sessions.
       */
      incomplete?: boolean;
      /**
       * Get sessions starting on or after this date.
       */
      startTimeFrom?: Date;
      /**
       * Get sessions starting on or before this date.
       */
      startTimeTo?: Date;
    };
    /**
     * Get session exercises with optional filters.
     */
    sessionExercises?: GetOptionsBase<WorkoutSessionExercise> & {
      /**
       * Get only recovery exercises.
       */
      recoveryOnly?: boolean;
    };
    /**
     * Get sets with optional filters.
     */
    sets?: GetOptionsBase<WorkoutSet>;
    /**
     * Get exercises with optional filters.
     */
    exercises?: GetOptionsBase<WorkoutExercise> & {
      /**
       * Filter by exercises targeting specific muscle groups (primary or secondary).
       */
      muscleGroupIds?: UUID[];
    };
    /**
     * Get exercise calibrations with optional filters.
     */
    exerciseCalibrations?: GetOptionsBase<WorkoutExerciseCalibration> & {
      /**
       * Limit to the N most recent calibrations.
       */
      mostRecent?: number;
      /**
       * Get calibrations recorded after this date.
       */
      recordedAfter?: Date;
    };
    /**
     * Get muscle groups.
     */
    muscleGroups?: GetOptionsBase<WorkoutMuscleGroup>;
    /**
     * Get equipment types.
     */
    equipmentTypes?: GetOptionsBase<WorkoutEquipmentType>;
  };
  insert?: {
    /**
     * Mesocycles to be inserted.
     */
    mesocycles?: WorkoutMesocycle[];
    /**
     * Microcycles to be inserted.
     */
    microcycles?: WorkoutMicrocycle[];
    /**
     * Sessions to be inserted.
     */
    sessions?: WorkoutSession[];
    /**
     * Session exercises to be inserted.
     */
    sessionExercises?: WorkoutSessionExercise[];
    /**
     * Sets to be inserted.
     */
    sets?: WorkoutSet[];
    /**
     * Exercises to be inserted.
     */
    exercises?: WorkoutExercise[];
    /**
     * Exercise calibrations to be inserted.
     */
    exerciseCalibrations?: WorkoutExerciseCalibration[];
    /**
     * Muscle groups to be inserted.
     */
    muscleGroups?: WorkoutMuscleGroup[];
    /**
     * Equipment types to be inserted.
     */
    equipmentTypes?: WorkoutEquipmentType[];
  };
  update?: {
    /**
     * Mesocycles to be updated.
     */
    mesocycles?: WorkoutMesocycle[];
    /**
     * Microcycles to be updated.
     */
    microcycles?: WorkoutMicrocycle[];
    /**
     * Sessions to be updated.
     */
    sessions?: WorkoutSession[];
    /**
     * Session exercises to be updated.
     */
    sessionExercises?: WorkoutSessionExercise[];
    /**
     * Sets to be updated.
     */
    sets?: WorkoutSet[];
    /**
     * Exercises to be updated.
     */
    exercises?: WorkoutExercise[];
    /**
     * Exercise calibrations to be updated.
     */
    exerciseCalibrations?: WorkoutExerciseCalibration[];
    /**
     * Muscle groups to be updated.
     */
    muscleGroups?: WorkoutMuscleGroup[];
    /**
     * Equipment types to be updated.
     */
    equipmentTypes?: WorkoutEquipmentType[];
  };
  delete?: {
    /**
     * IDs of mesocycles to be deleted.
     */
    mesocycles?: UUID[];
    /**
     * IDs of microcycles to be deleted.
     */
    microcycles?: UUID[];
    /**
     * IDs of sessions to be deleted.
     */
    sessions?: UUID[];
    /**
     * IDs of session exercises to be deleted.
     */
    sessionExercises?: UUID[];
    /**
     * IDs of sets to be deleted.
     */
    sets?: UUID[];
    /**
     * IDs of exercises to be deleted.
     */
    exercises?: UUID[];
    /**
     * IDs of exercise calibrations to be deleted.
     */
    exerciseCalibrations?: UUID[];
    /**
     * IDs of muscle groups to be deleted.
     */
    muscleGroups?: UUID[];
    /**
     * IDs of equipment types to be deleted.
     */
    equipmentTypes?: UUID[];
  };
}

/**
 * Represents the input to the workout app primary endpoint.
 */
export interface ProjectWorkoutPrimaryInput {
  apiKey: UUID;
  options: ProjectWorkoutPrimaryEndpointOptions;
  socketId?: string;
}

/**
 * Represents the output of the workout app primary endpoint.
 */
export interface ProjectWorkoutPrimaryOutput {
  mesocycles?: WorkoutMesocycle[];
  microcycles?: WorkoutMicrocycle[];
  sessions?: WorkoutSession[];
  sessionExercises?: WorkoutSessionExercise[];
  sets?: WorkoutSet[];
  exercises?: WorkoutExercise[];
  exerciseCalibrations?: WorkoutExerciseCalibration[];
  muscleGroups?: WorkoutMuscleGroup[];
  equipmentTypes?: WorkoutEquipmentType[];
}
