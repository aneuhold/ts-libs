import type { UUID } from 'crypto';
import { z } from 'zod';
import { FatigueSchema } from '../../embedded-types/workout/Fatigue.js';
import { RsmSchema } from '../../embedded-types/workout/Rsm.js';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import { BaseDocumentWithTypeSchema } from '../BaseDocument.js';

/**
 * The docType value for WorkoutSessionExercise documents.
 */
export const WorkoutSessionExercise_docType = 'workoutSessionExercise';

/**
 * The schema for {@link WorkoutSessionExercise} documents.
 */
export const WorkoutSessionExerciseSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  docType: z.literal(WorkoutSessionExercise_docType).default(WorkoutSessionExercise_docType),
  /**
   * The ID of the workout session this exercise belongs to.
   */
  workoutSessionId: z.uuidv7().transform((val) => val as UUID),
  /**
   * The ID of the workout exercise being performed.
   */
  workoutExerciseId: z.uuidv7().transform((val) => val as UUID),
  /**
   * The order of sets for this exercise, represented as an array of WorkoutSet IDs.
   */
  setOrder: z.array(z.uuidv7().transform((val) => val as UUID)).default([]),
  /**
   * The Raw Stimulus Magnitude for this specific exercise within the session.
   *
   * This is the sum of mindMuscleConnection, pump, and disruption (0-9).
   */
  rsm: RsmSchema.nullish(),
  /**
   * The fatigue measurement for this specific exercise within the session.
   *
   * The total fatigue score is the sum of all three components (0-9).
   */
  fatigue: FatigueSchema.nullish(),
  /**
   * The date this session exercise was created.
   */
  createdDate: z.date().default(() => new Date()),
  /**
   * The date this session exercise was last updated.
   */
  lastUpdatedDate: z.date().default(() => new Date())
});

/**
 * Represents a specific exercise performed within a workout session.
 *
 * This is a join entity that connects a WorkoutSession to a WorkoutExercise
 * and contains the sets performed for that exercise in that session.
 */
export type WorkoutSessionExercise = z.infer<typeof WorkoutSessionExerciseSchema>;
