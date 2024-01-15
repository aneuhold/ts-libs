import { EJSON } from 'bson';

/**
 * A service for low-level utilities related to documents.
 */
export default class DocumentService {
  static deepCopy<T extends object>(obj: T): T {
    return EJSON.parse(EJSON.stringify(obj, { relaxed: false }));
  }
}
