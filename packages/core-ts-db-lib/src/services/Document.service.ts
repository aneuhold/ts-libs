import type { UUID } from 'crypto';
import { v7 as uuidv7 } from 'uuid';
import type { BaseDocument } from '../documents/BaseDocument.js';

/**
 * Utility type for mapping document IDs to their corresponding documents.
 *
 * @template T - The type of document being mapped, must extend BaseDocument.
 */
export type DocumentMap<T extends BaseDocument> = {
  [docId: UUID]: T | undefined;
};

/**
 * Represents database operations for a document type.
 *
 * @template T - The type of document, must extend BaseDocument.
 */
export type DocumentOperations<T extends BaseDocument> = {
  /**
   * Documents to create.
   */
  create?: T[];
  /**
   * Documents to update. Must include _id field.
   */
  update?: Partial<T>[];
  /**
   * Document IDs to delete.
   */
  delete?: UUID[];
};

/**
 * A service for low-level utilities related to documents.
 */
export default class DocumentService {
  /**
   * Creates a deep copy of an object using structuredClone.
   *
   * @param obj - The object to copy.
   */
  static deepCopy<T extends Record<PropertyKey, unknown>>(obj: T): T {
    return structuredClone(obj);
  }

  static generateID(): UUID {
    return DocumentService.toUUID(uuidv7());
  }

  /**
   * Narrows a UUID string to the branded {@link UUID} type. Callers are
   * expected to have validated the input — either via `z.uuidv7()` (the
   * `UUIDSchema` transform) or by generating it with `uuidv7()`.
   *
   * A runtime-enforcing implementation (e.g. `split('-')` + template-literal
   * reconstruction) would narrow without a cast but allocates on every call,
   * and this runs on every ID read/write. Since upstream validation already
   * covers this, trust the caller and cast.
   *
   * @param value A UUID string that has already been validated upstream.
   */
  static toUUID(value: string): UUID {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return value as UUID;
  }
}
