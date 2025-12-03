import type { UUID } from 'crypto';
import { v7 as uuidv7 } from 'uuid';
import BaseDocument from '../documents/BaseDocument.js';

/**
 * Utility type for mapping document IDs to their corresponding documents.
 *
 * @template T - The type of document being mapped, must extend BaseDocument.
 */
export type DocumentMap<T extends BaseDocument> = {
  [docId: UUID]: T | undefined;
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
