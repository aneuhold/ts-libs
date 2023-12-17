import { ObjectId } from 'bson';
import crypto from 'crypto';
import BaseDocument from '../BaseDocument';

/**
 * A document containing an API key for a particular user. This is stored
 * separately from the {@link User} document to enhance security a bit.
 */
export default class ApiKey implements BaseDocument {
  _id = new ObjectId();

  /**
   * The API key for the user.
   */
  key = crypto.randomUUID();

  /**
   * The user ID that this key is for. This field is indexed in the database.
   */
  userId: ObjectId;

  /**
   * Constructs a new {@link ApiKey} for the provided user.
   */
  constructor(userId: ObjectId) {
    this.userId = userId;
  }
}
