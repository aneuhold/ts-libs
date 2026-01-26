import type { UUID } from 'crypto';
import { z } from 'zod';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import {
  BaseDocumentWithTypeSchema,
  BaseDocumentWithUpdatedAndCreatedDatesSchema
} from '../BaseDocument.js';
import type { WorkoutExercise } from './WorkoutExercise.js';

/**
 * The docType value for WorkoutExerciseCalibration documents.
 */
export const WorkoutExerciseCalibration_docType = 'workoutExerciseCalibration';

/**
 * The schema for {@link WorkoutExerciseCalibration} documents.
 */
export const WorkoutExerciseCalibrationSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  ...BaseDocumentWithUpdatedAndCreatedDatesSchema.shape,
  docType: z
    .literal(WorkoutExerciseCalibration_docType)
    .default(WorkoutExerciseCalibration_docType),
  /**
   * The ID of the exercise this calibration is for.
   */
  workoutExerciseId: z.uuidv7().transform((val) => val as UUID),
  /**
   * Custom exercise properties at the time of calibration.
   *
   * This is populated from WorkoutExercise.customProperties at creation time
   * to preserve historical context.
   */
  exerciseProperties: z.record(z.string(), z.unknown()).nullish(),
  /**
   * The number of reps performed at the calibration weight.
   *
   * This should be the lowest amount of reps the person can do with the highest
   * amount of weight they can handle for this exercise.
   */
  reps: z.number(),
  /**
   * The weight used for this calibration.
   */
  weight: z.number(),
  /**
   * The date this calibration was recorded.
   */
  dateRecorded: z.date().default(() => new Date())
});

/**
 * Represents a calibration point for an exercise, used to calculate 1RM and
 * track strength progression.
 *
 * These documents store the lowest amount of reps the person can do for an
 * exercise with the highest amount of weight they can handle. This is used
 * for 1RM calculations using the NASM formula:
 * 1RM = (Weight Lifted x Reps / 30.48) + Weight Lifted
 *
 * WorkoutMesocycle documents reference these to lock in which calibration was
 * used, ensuring historical 1RM values remain accurate even if calibrations
 * are updated later.
 */
export type WorkoutExerciseCalibration = z.infer<typeof WorkoutExerciseCalibrationSchema>;

/**
 * Represents a calibration paired with its associated exercise definition.
 */
export type CalibrationExercisePair = {
  calibration: WorkoutExerciseCalibration;
  exercise: WorkoutExercise;
};
