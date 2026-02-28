import { z } from 'zod';
import { WorkoutEquipmentTypeSchema } from '../../documents/workout/WorkoutEquipmentType.js';
import { WorkoutExerciseSchema } from '../../documents/workout/WorkoutExercise.js';
import { WorkoutExerciseCalibrationSchema } from '../../documents/workout/WorkoutExerciseCalibration.js';
import { WorkoutSessionExerciseSchema } from '../../documents/workout/WorkoutSessionExercise.js';
import { WorkoutSetSchema } from '../../documents/workout/WorkoutSet.js';

/**
 * The schema for {@link WorkoutExerciseCTO}.
 *
 * Bundles an exercise with its best calibration, best set, equipment type,
 * and most recent accumulation performance. Eliminates the need for core
 * service methods to separately accept exercise, calibration, and equipment
 * parameters and then perform expensive lookups.
 */
export const WorkoutExerciseCTOSchema = z.object({
  ...WorkoutExerciseSchema.shape,

  /**
   * The equipment type associated with this exercise.
   * Included so weight rounding can be performed without additional lookups.
   */
  equipmentType: WorkoutEquipmentTypeSchema,

  /**
   * The WorkoutExerciseCalibration with the highest calculated 1RM for this
   * exercise. Includes both manually-entered calibrations and auto-created
   * ones (from best sets). Null if no calibrations exist.
   */
  bestCalibration: WorkoutExerciseCalibrationSchema.nullable(),

  /**
   * The completed WorkoutSet with the highest calculated 1RM for this
   * exercise, across all sessions ever performed. Null if the exercise has
   * never been performed.
   *
   * This may or may not match the set that generated bestCalibration. It
   * provides the raw source data for 1RM comparison.
   */
  bestSet: WorkoutSetSchema.nullable(),

  /**
   * The most recent completed WorkoutSessionExercise for this exercise,
   * from a non-deload accumulation session. Deload sessions (where all sets
   * have plannedRir === null) are excluded since their halved weights/reps
   * are not meaningful baselines for progression.
   *
   * Null if the exercise has never been performed in an accumulation session.
   *
   * Contains: sorenessScore, performanceScore, rsm, fatigue, setOrder, etc.
   */
  lastSessionExercise: WorkoutSessionExerciseSchema.nullable(),

  /**
   * The first WorkoutSet from the lastSessionExercise's setOrder.
   * This is the "anchor" set that progression calculations use since
   * subsequent sets are derived from the first via intra-session fatigue
   * drops.
   *
   * Null if no previous accumulation performance exists.
   */
  lastFirstSet: WorkoutSetSchema.nullable()
});

/**
 * A CTO that bundles a workout exercise with its best calibration, best set,
 * equipment type, and most recent accumulation performance data. This replaces
 * the CalibrationExercisePair pattern with a richer data structure that
 * eliminates the need for cross-document lookups in service methods.
 */
export type WorkoutExerciseCTO = z.infer<typeof WorkoutExerciseCTOSchema>;
