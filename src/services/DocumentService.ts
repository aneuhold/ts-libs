import { EJSON } from 'bson';
import BaseDocument from '../documents/BaseDocument';

/**
 * A utility type for a map of documents.
 */
export type DocumentMap<T extends BaseDocument> = {
  [docId: string]: T | undefined;
};

/**
 * A service for low-level utilities related to documents.
 */
export default class DocumentService {
  static deepCopy<T extends object>(obj: T): T {
    return EJSON.parse(EJSON.stringify(obj, { relaxed: false })) as T;
  }
}
