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
 * The paid-for features a workout user can hold. Each value is a key of
 * {@link WorkoutUserConfig} `entitlements`, and has an entry in
 * `workoutEntitlementDefinitions`.
 */
export enum WorkoutEntitlement {
  Supporter = 'supporter'
}

/**
 * The schema for {@link WorkoutUserConfig} documents.
 */
export const WorkoutUserConfigSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  ...BaseDocumentWithUpdatedAndCreatedDatesSchema.shape,
  docType: z.literal(WorkoutUserConfig_docType).default(WorkoutUserConfig_docType),
  /**
   * The user's entitlements, keyed by {@link WorkoutEntitlement}. A missing
   * entitlement means the user does not hold it.
   */
  entitlements: z
    .partialRecord(
      z.enum(WorkoutEntitlement),
      z.object({
        /**
         * When the entitlement expires. Null or missing means the user does
         * not hold it.
         */
        expiresAt: z.date().nullish()
      })
    )
    .default({})
});

/**
 * Represents the user configuration for the workout app.
 */
export type WorkoutUserConfig = z.infer<typeof WorkoutUserConfigSchema>;
