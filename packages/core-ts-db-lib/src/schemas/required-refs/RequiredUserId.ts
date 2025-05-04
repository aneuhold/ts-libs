import { ObjectId } from 'bson';
import BaseDocument from '../../documents/BaseDocument.js';

/**
 * A document that has a `userId` that must be associated to be valid.
 */
export default abstract class RequiredUserId extends BaseDocument {
  abstract userId: ObjectId;
}
