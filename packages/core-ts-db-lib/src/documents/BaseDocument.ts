import type { Document } from 'bson';
import { ObjectId } from 'bson';

/**
 * Base class for all document types stored in a document database.
 *
 * Provides the common `_id` field required by MongoDB and other
 * document databases. All document types should extend this class.
 */
export default abstract class BaseDocument implements Document {
  /** The unique identifier for this document */
  _id: ObjectId = new ObjectId();
}
