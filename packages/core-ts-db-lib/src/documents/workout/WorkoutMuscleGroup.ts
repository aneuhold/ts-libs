import { z } from 'zod';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import {
  BaseDocumentWithTypeSchema,
  BaseDocumentWithUpdatedAndCreatedDatesSchema
} from '../BaseDocument.js';

/**
 * The docType value for WorkoutMuscleGroup documents.
 */
export const WorkoutMuscleGroup_docType = 'workoutMuscleGroup';

/**
 * The schema for {@link WorkoutMuscleGroup} documents.
 */
export const WorkoutMuscleGroupSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  ...BaseDocumentWithUpdatedAndCreatedDatesSchema.shape,
  docType: z.literal(WorkoutMuscleGroup_docType).default(WorkoutMuscleGroup_docType),
  /**
   * The name of the muscle group.
   */
  name: z.string(),
  /**
   * An optional description of the muscle group.
   */
  description: z.string().nullish()
});

/**
 * Represents a muscle group that can be targeted by exercises.
 */
export type WorkoutMuscleGroup = z.infer<typeof WorkoutMuscleGroupSchema>;
