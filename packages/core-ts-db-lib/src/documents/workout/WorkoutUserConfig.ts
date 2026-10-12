import { z } from 'zod';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import {
  BaseDocumentWithTypeSchema,
  BaseDocumentWithUpdatedAndCreatedDatesSchema
} from '../BaseDocument.js';

/**
 * The docType value for WorkoutUserConfig documents.
 */
export const WorkoutUserConfig_docType = 'workoutUserConfig';

/**
 * The schema for {@link WorkoutUserConfig} documents.
 */
export const WorkoutUserConfigSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  ...BaseDocumentWithUpdatedAndCreatedDatesSchema.shape,
  docType: z.literal(WorkoutUserConfig_docType).default(WorkoutUserConfig_docType),
  /**
   * The user's entitlements (paid-for features).
   */
  entitlements: z
    .object({
      /**
       * When the user's supporter entitlement expires. Null or missing means
       * the user is not a supporter.
       */
      supporterEntitlementExpiresAt: z.date().nullish()
    })
    .default({})
});

/**
 * Represents the user configuration for the workout app.
 */
export type WorkoutUserConfig = z.infer<typeof WorkoutUserConfigSchema>;
