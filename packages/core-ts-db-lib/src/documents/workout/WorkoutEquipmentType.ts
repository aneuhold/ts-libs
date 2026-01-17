import { z } from 'zod';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import { BaseDocumentWithTypeSchema } from '../BaseDocument.js';

/**
 * The docType value for WorkoutEquipmentType documents.
 */
export const WorkoutEquipmentType_docType = 'workoutEquipmentType';

/**
 * The schema for {@link WorkoutEquipmentType} documents.
 */
export const WorkoutEquipmentTypeSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  docType: z.literal(WorkoutEquipmentType_docType).default(WorkoutEquipmentType_docType),
  /**
   * The title of the equipment type.
   */
  title: z.string(),
  /**
   * The available weight options for this equipment type.
   *
   * This is used to assist in algorithms where weight needs to be incremented
   * or decremented for a schedule. For fixed weights like dumbbells, this would
   * be a list of available weights. For adjustable equipment like barbells,
   * this can be calculated based on minimum weight (e.g., the bar) and possible
   * increments.
   */
  weightOptions: z.array(z.number()).nullish(),
  /**
   * The date this equipment type was created.
   */
  createdDate: z.date().default(() => new Date()),
  /**
   * The date this equipment type was last updated.
   */
  lastUpdatedDate: z.date().default(() => new Date())
});

/**
 * Represents a type of workout equipment with its available weight options.
 */
export type WorkoutEquipmentType = z.infer<typeof WorkoutEquipmentTypeSchema>;
