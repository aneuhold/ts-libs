import type { UUID } from 'crypto';
import { z } from 'zod';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import { BaseDocumentWithTypeSchema } from '../BaseDocument.js';

/**
 * The docType value for WorkoutSet documents.
 */
export const WorkoutSet_docType = 'workoutSet';

/**
 * The schema for {@link WorkoutSet} documents.
 */
export const WorkoutSetSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  docType: z.literal(WorkoutSet_docType).default(WorkoutSet_docType),
  /**
   * The ID of the workout exercise this set belongs to.
   */
  workoutExerciseId: z.uuidv7().transform((val) => val as UUID),
  /**
   * The ID of the workout session this set was performed in.
   */
  workoutSessionId: z.uuidv7().transform((val) => val as UUID),
  /**
   * The ID of the workout session exercise this set belongs to.
   */
  workoutSessionExerciseId: z.uuidv7().transform((val) => val as UUID),
  /**
   * The planned number of reps for this set.
   */
  plannedReps: z.number().nullish(),
  /**
   * The planned weight for this set.
   */
  plannedWeight: z.number().nullish(),
  /**
   * The planned Reps in Reserve (RIR) for this set.
   *
   * RIR is the set's proximity to muscle failure - how many reps you have left
   * before you completely fail to produce the movement.
   *
   * Recommended range is 2-3 RIR on average, with 0-5 RIR being the effective range.
   */
  plannedRir: z.number().nullish(),
  /**
   * The actual number of reps performed in this set.
   */
  actualReps: z.number().nullish(),
  /**
   * The actual weight used for this set.
   */
  actualWeight: z.number().nullish(),
  /**
   * The actual Reps in Reserve (RIR) for this set.
   *
   * This should be recorded to track proximity to failure and adjust future
   * programming.
   */
  rir: z.number().nullish(),
  /**
   * Custom exercise properties for this set.
   *
   * This is populated from WorkoutExercise.customProperties at creation time.
   * When customProperties are changed on the exercise, they should be updated
   * on all existing WorkoutSet documents with that WorkoutExercise linked to it.
   */
  exerciseProperties: z.record(z.string(), z.unknown()).nullish(),
  /**
   * The date this set was created.
   */
  createdDate: z.date().default(() => new Date()),
  /**
   * The date this set was last updated.
   */
  lastUpdatedDate: z.date().default(() => new Date())
});

/**
 * Represents a single set of an exercise performed during a workout session.
 *
 * Sets track both planned and actual performance data, allowing for comparison
 * between programming and execution. This is crucial for algorithm-based
 * progression and adaptation.
 *
 * Effective sets are defined as sets with:
 * - 5-30 reps
 * - 0-5 RIR (Reps in Reserve)
 * - Weight between 30% and 85% of 1RM per rep
 *
 * The recommended average RIR is 2-3 to balance stimulus and fatigue.
 */
export type WorkoutSet = z.infer<typeof WorkoutSetSchema>;
