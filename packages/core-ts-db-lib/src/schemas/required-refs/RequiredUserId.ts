import type { UUID } from 'crypto';
import z from 'zod';
import { BaseDocumentSchema } from '../../documents/BaseDocument.js';

/**
 * Schema for {@link RequiredUserId} documents.
 */
export const RequiredUserIdSchema = BaseDocumentSchema.extend({
  /**
   * Does this work?
   */
  userId: z
    .uuidv7()
    .transform((val) => val as UUID)
    .describe('The user ID that this document is for. This field is indexed in the database.')
});

/**
 * A document that has a `userId` that must be associated to be valid.
 */
export type RequiredUserId = z.infer<typeof RequiredUserIdSchema>;
