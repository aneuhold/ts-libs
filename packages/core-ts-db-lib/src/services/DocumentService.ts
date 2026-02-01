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
   * Creates a deep copy of an object using EJSON serialization.
   *
   * @param obj - The object to copy.
   */
  static deepCopy<T extends object>(obj: T): T {
    return structuredClone(obj);
  }

  static generateID(): UUID {
    return uuidv7() as UUID;
  }
}
