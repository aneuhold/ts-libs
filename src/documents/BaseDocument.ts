import { Document, ObjectId } from 'bson';

/**
 * A base document which other types that will be stored in a document DB can
 * inherit from.
 */
export default abstract class BaseDocument implements Document {
  _id: ObjectId = new ObjectId();
}
