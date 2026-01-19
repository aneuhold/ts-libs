import type { UUID } from 'crypto';
import { z } from 'zod';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import { BaseDocumentWithTypeSchema } from '../BaseDocument.js';

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
   * The soreness score for this microcycle (0-3).
   *
   * - 0: You did not get at all sore in the target muscles
   * - 1: You got stiff for a few hours after training and had mild soreness that resolved by next session
   * - 2: You got DOMS that resolved just in time for the next session
   * - 3: You got DOMS that remained for the next session
   */
  sorenessScore: z.number().min(0).max(3).nullish(),
  /**
   * The performance score for this microcycle (0-3).
   *
   * - 0: You hit your target reps, but had to do 2+ more reps than planned to hit target RIR, or hit target reps at 2+ reps before target RIR
   * - 1: You hit your target reps, but had to do 0-1 more reps than planned to hit target RIR, or hit target reps at 1 rep before target RIR
   * - 2: You hit your target reps after your target RIR
   * - 3: You could not match last week's reps at any RIR
   */
  performanceScore: z.number().min(0).max(3).nullish(),
  /**
   * The date this microcycle was created.
   */
  createdDate: z.date().default(() => new Date()),
  /**
   * The date this microcycle was last updated.
   */
  lastUpdatedDate: z.date().default(() => new Date())
});

/**
 * Represents a microcycle - the shortest cycle of training that includes all
 * workout sessions and rest days and is repeated.
 *
 * Typically, but not always, this is a week (7 days).
 */
export type WorkoutMicrocycle = z.infer<typeof WorkoutMicrocycleSchema>;
