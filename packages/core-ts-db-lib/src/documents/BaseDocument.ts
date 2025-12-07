import type { UUID } from 'crypto';
import z from 'zod';
import DocumentService from '../services/DocumentService.js';

/**
 * Base schema for all documents. Provides the common `_id` field required by
 * MongoDB and other document databases. All document schemas should extend
 * this schema.
 */
export const BaseDocumentSchema = z.object({
  _id: z
    .uuidv7()
    .default(() => DocumentService.generateID())
    .transform((val) => val as UUID)
});

/**
 * Base schema for all documents with a `docType` field.
 */
export const BaseDocumentWithTypeSchema = BaseDocumentSchema.extend({
  docType: z.string()
});

/**
 * Base document type for all documents stored in a document database.
 */
export type BaseDocument = z.infer<typeof BaseDocumentSchema>;

/**
 * Base document type with a `docType` field.
 */
export type BaseDocumentWithType = z.infer<typeof BaseDocumentWithTypeSchema>;
