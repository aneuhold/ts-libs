import type { UUID } from 'crypto';
import { z } from 'zod';
import { FatigueSchema } from '../../embedded-types/workout/Fatigue.js';
import { RsmSchema } from '../../embedded-types/workout/Rsm.js';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import { BaseDocumentWithTypeSchema } from '../BaseDocument.js';

/**
 * The docType value for WorkoutSession documents.
 */
export const WorkoutSession_docType = 'workoutSession';

/**
 * The schema for {@link WorkoutSession} documents.
 */
export const WorkoutSessionSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  docType: z.literal(WorkoutSession_docType).default(WorkoutSession_docType),
  /**
   * The ID of the microcycle this session belongs to.
   *
   * This is optional because users can track workouts outside of a microcycle.
   */
  workoutMicrocycleId: z
    .uuidv7()
    .transform((val) => val as UUID)
    .nullish(),
  /**
   * The title of this workout session.
   */
  title: z.string(),
  /**
   * An optional description of this workout session.
   */
  description: z.string().nullish(),
  /**
   * The start time of this workout session.
   */
  startTime: z.date(),
  /**
   * Whether this workout session has been completed.
   */
  complete: z.boolean().default(false),
  /**
   * The order of exercises in this session, represented as an array of
   * WorkoutSessionExercise IDs.
   *
   * This was chosen as a compromise for querying efficiency in order to quickly
   * get metrics like "Last time you did this exercise when it was preceded by
   * these 4 other exercises, you did this".
   */
  sessionExerciseOrder: z.array(z.uuidv7().transform((val) => val as UUID)).default([]),
  /**
   * The Raw Stimulus Magnitude for this session.
   *
   * This is the sum of mindMuscleConnection, pump, and disruption (0-9).
   */
  rsm: RsmSchema.nullish(),
  /**
   * The fatigue measurement for this session.
   *
   * The total fatigue score is the sum of all three components (0-9).
   * The Stimulus to Fatigue Ratio (SFR) can be calculated as RSM total / Fatigue total.
   */
  fatigue: FatigueSchema.nullish(),
  /**
   * The date this session was created.
   */
  createdDate: z.date().default(() => new Date()),
  /**
   * The date this session was last updated.
   */
  lastUpdatedDate: z.date().default(() => new Date())
});

/**
 * Represents a workout session containing one or more exercises.
 *
 * A session can be part of a microcycle (which may be part of a mesocycle) or
 * can be tracked independently for free-form workout tracking.
 */
export type WorkoutSession = z.infer<typeof WorkoutSessionSchema>;
