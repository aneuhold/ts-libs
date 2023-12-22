import { ObjectId } from 'bson';
import BaseDocument from './BaseDocument';

/**
 * A base document type that has a user ID associated with it. This is useful
 * for filtering on all documents that a user has access to.
 */
export default abstract class BaseDocumentWithUserId extends BaseDocument {
  abstract userId: ObjectId;
}
