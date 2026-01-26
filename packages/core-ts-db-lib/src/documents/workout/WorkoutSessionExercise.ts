import type { UUID } from 'crypto';
import { z } from 'zod';
import { FatigueSchema } from '../../embedded-types/workout/Fatigue.js';
import { RsmSchema } from '../../embedded-types/workout/Rsm.js';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import {
  BaseDocumentWithTypeSchema,
  BaseDocumentWithUpdatedAndCreatedDatesSchema
} from '../BaseDocument.js';

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
  ...BaseDocumentWithUpdatedAndCreatedDatesSchema.shape,
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
   * The soreness score for this session exercise (0-3).
   *
   * - 0: You did not get at all sore in the target muscles
   * - 1: You got stiff for a few hours after training and had mild soreness that resolved by next session
   * - 2: You got DOMS that resolved just in time for the next session
   * - 3: You got DOMS that remained for the next session
   */
  sorenessScore: z.number().min(0).max(3).nullish(),
  /**
   * The performance score for this session exercise (0-3).
   *
   * - 0: You hit your target reps, but had to do 2+ more reps than planned to hit target RIR, or hit target reps at 2+ reps before target RIR
   * - 1: You hit your target reps, but had to do 0-1 more reps than planned to hit target RIR, or hit target reps at 1 rep before target RIR
   * - 2: You hit your target reps after your target RIR
   * - 3: You could not match last week's reps at any RIR
   */
  performanceScore: z.number().min(0).max(3).nullish(),
  /**
   * Determines if this exercise is being used as a recovery exercise, due to high soreness / low
   * performance in the previous microcycle for this exercise.
   */
  isRecoveryExercise: z.boolean().default(false)
});

/**
 * Represents a specific exercise performed within a workout session.
 *
 * This is a join entity that connects a WorkoutSession to a WorkoutExercise
 * and contains the sets performed for that exercise in that session.
 */
export type WorkoutSessionExercise = z.infer<typeof WorkoutSessionExerciseSchema>;
