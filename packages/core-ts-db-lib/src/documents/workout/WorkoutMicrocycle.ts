import { z } from 'zod';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import { UUIDSchema } from '../../schemas/UUIDSchema.js';
import {
  BaseDocumentWithTypeSchema,
  BaseDocumentWithUpdatedAndCreatedDatesSchema
} from '../BaseDocument.js';

/**
 * The docType value for WorkoutMicrocycle documents.
 */
export const WorkoutMicrocycle_docType = 'workoutMicrocycle';

/**
 * The schema for {@link WorkoutMicrocycle} documents.
 */
export const WorkoutMicrocycleSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  ...BaseDocumentWithUpdatedAndCreatedDatesSchema.shape,
  docType: z.literal(WorkoutMicrocycle_docType).default(WorkoutMicrocycle_docType),
  /**
   * The ID of the mesocycle this microcycle belongs to.
   *
   * This is optional because users can track workouts outside of a mesocycle.
   */
  workoutMesocycleId: UUIDSchema.nullish(),
  /**
   * The start date of this microcycle.
   */
  startDate: z.date(),
  /**
   * The end date of this microcycle.
   */
  endDate: z.date(),
  /**
   * The sessions that exist in this microcycle, in the order they are
   * performed, represented as an array of WorkoutSession IDs.
   *
   * This holds the sessions that actually exist, not a layout of the days a
   * mesocycle planned. A position in this array therefore means nothing beyond ordering. It could
   * be different than the original planned number of sessions in a microcycle if the user
   * deleted a session part-way through.
   */
  sessionOrder: z.array(UUIDSchema).default([]),
  /**
   * The date this microcycle was marked as completed by the user.
   *
   * This helps for performance reasons, but also acts as our indicator that the mesocycle has been
   * regenerated after the microcycle was completed.
   */
  completedDate: z.date().nullish()
});

/**
 * Represents a microcycle - the shortest cycle of training that includes all
 * workout sessions and rest days and is repeated.
 *
 * Typically, but not always, this is a week (7 days).
 */
export type WorkoutMicrocycle = z.infer<typeof WorkoutMicrocycleSchema>;
