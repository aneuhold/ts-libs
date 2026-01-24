import type { UUID } from 'crypto';
import { z } from 'zod';
import { FatigueSchema } from '../../embedded-types/workout/Fatigue.js';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import { BaseDocumentWithTypeSchema } from '../BaseDocument.js';

/**
 * The different types of exercise properties.
 */
export enum ExercisePropertyType {
  Weight = 'Weight',
  Text = 'Text',
  YesNo = 'Yes/No',
  Number = 'Number'
}

/**
 * Zod schema for {@link ExerciseProperty}.
 */
export const ExercisePropertySchema = z.object({
  /**
   * The name of the custom property.
   */
  name: z.string(),
  /**
   * The type of the custom property. See {@link ExercisePropertyType} for details.
   */
  type: z.enum(ExercisePropertyType)
});

/**
 * Represents a custom property for an exercise.
 */
export type ExerciseProperty = z.infer<typeof ExercisePropertySchema>;

/**
 * The rep range for an exercise.
 *
 * - Heavy exercises: Normally done in the 5-15 rep range
 * - Medium exercises: Normally done in the 10-20 rep range (This should be the most common)
 * - Light exercises: Normally done in the 15-30 rep range
 */
export enum ExerciseRepRange {
  Heavy = 'Heavy',
  Medium = 'Medium',
  Light = 'Light'
}

/**
 * The preferred progression type for an exercise.
 *
 * - Rep: Add 2 reps per week (default). When max reps exceeded, increase weight by smallest increment.
 * - Load: Add smallest available increment each week (or 2% of current load, whichever is greater).
 */
export enum ExerciseProgressionType {
  Rep = 'Rep',
  Load = 'Load'
}

/**
 * The docType value for WorkoutExercise documents.
 */
export const WorkoutExercise_docType = 'workoutExercise';

/**
 * The schema for {@link WorkoutExercise} documents.
 */
export const WorkoutExerciseSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  docType: z.literal(WorkoutExercise_docType).default(WorkoutExercise_docType),
  /**
   * The name of the exercise.
   *
   * WorkoutExercise is meant to be specific to a particular way of doing an
   * exercise. For example there should be separate exercises for:
   * - Barbell Bench Press (Straight Sets)
   * - Barbell Bench Press (Myoreps)
   * - Dumbbell Bench Press (Straight Sets, Eccentric Focus, 3s Down, 1s Pause)
   *
   * It needs to be ultra specific, because even a different hand position will
   * result in a different exercise and should be tracked separately.
   */
  exerciseName: z.string(),
  /**
   * The ID of the equipment type used for this exercise.
   */
  workoutEquipmentTypeId: z.uuidv7().transform((val) => val as UUID),
  /**
   * Optional notes about the exercise.
   */
  notes: z.string().nullish(),
  /**
   * The recommended rest time in seconds between sets.
   *
   * This is used for a timer that will be built into the app for each exercise.
   * No tracking will be done of the timer, it will be purely client-side.
   */
  restSeconds: z.number().nullish(),
  /**
   * Custom properties for this exercise.
   *
   * When customProperties are changed, they should be propagated to all
   * existing WorkoutSet documents with this WorkoutExercise linked to it.
   */
  customProperties: z.array(ExercisePropertySchema).nullish(),
  /**
   * The recommended rep range for this exercise. See {@link ExerciseRepRange} for details.
   */
  repRange: z.enum(ExerciseRepRange),
  /**
   * The preferred progression type for this exercise.
   *
   * Defaults to Rep progression if not specified.
   */
  preferredProgressionType: z.enum(ExerciseProgressionType).default(ExerciseProgressionType.Rep),
  /**
   * The IDs of the primary muscle groups targeted by this exercise.
   */
  primaryMuscleGroups: z.array(z.uuidv7().transform((val) => val as UUID)).default([]),
  /**
   * The IDs of the secondary muscle groups targeted by this exercise.
   */
  secondaryMuscleGroups: z.array(z.uuidv7().transform((val) => val as UUID)).default([]),
  /**
   * An initial guess of the fatigue this exercise produces.
   *
   * This is needed for scheduling algorithms when empirical data isn't yet available.
   */
  initialFatigueGuess: FatigueSchema,
  /**
   * The date this exercise was created.
   */
  createdDate: z.date().default(() => new Date()),
  /**
   * The date this exercise was last updated.
   */
  lastUpdatedDate: z.date().default(() => new Date())
});

/**
 * Represents a specific variation of an exercise with all its details.
 *
 * This is intentionally very specific - each variation (different grip, tempo,
 * equipment position, etc.) should be its own exercise for accurate tracking.
 */
export type WorkoutExercise = z.infer<typeof WorkoutExerciseSchema>;
