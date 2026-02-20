import type { UUID } from 'crypto';
import { z } from 'zod';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
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
  workoutMesocycleId: z
    .uuidv7()
    .transform((val) => val as UUID)
    .nullish(),
  /**
   * The start date of this microcycle.
   */
  startDate: z.date(),
  /**
   * The end date of this microcycle.
   */
  endDate: z.date(),
  /**
   * The order of sessions in this microcycle, represented as an array of
   * WorkoutSession IDs.
   *
   * This makes it easier to reason about the order of sessions before dates
   * are assigned.
   */
  sessionOrder: z.array(z.uuidv7().transform((val) => val as UUID)).default([]),
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
