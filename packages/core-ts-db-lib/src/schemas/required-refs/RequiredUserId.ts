import z from 'zod';
import { BaseDocumentSchema } from '../../documents/BaseDocument.js';
import { UUIDSchema } from '../UUIDSchema.js';

/**
 * Schema for {@link RequiredUserId} documents.
 */
export const RequiredUserIdSchema = BaseDocumentSchema.extend({
  /**
   * The user ID that this document is for. This field is indexed in the database.
   */
  userId: UUIDSchema
});

/**
 * A document that has a `userId` that must be associated to be valid.
 */
export type RequiredUserId = z.infer<typeof RequiredUserIdSchema>;
