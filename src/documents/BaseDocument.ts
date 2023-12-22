import { ObjectId, Document } from 'bson';

/**
 * A base document which other types that will be stored in a document DB can
 * inherit from.
 */
export default abstract class BaseDocument extends Document {
  _id = new ObjectId();
}
