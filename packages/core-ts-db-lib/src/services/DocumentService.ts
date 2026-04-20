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
  static deepCopy<T>(obj: T): T {
    return structuredClone(obj);
  }

  static generateID(): UUID {
    return DocumentService.toUUID(uuidv7());
  }

  /**
   * Narrows a validated UUID string to the branded {@link UUID} type without
   * using a type assertion. Throws when the input is not in the expected
   * `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` shape.
   *
   * @param value A UUID string that has already been validated.
   */
  static toUUID(value: string): UUID {
    const parts = value.split('-');
    if (parts.length !== 5) {
      throw new Error(`Invalid UUID: ${value}`);
    }
    const [a, b, c, d, e] = parts;
    return `${a}-${b}-${c}-${d}-${e}`;
  }
}
