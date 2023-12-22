import { ObjectId } from 'bson';
import crypto from 'crypto';
import BaseDocument from '../BaseDocument';
import BaseDocumentWithUserId from '../BaseDocumentWithUserId';

/**
 * A document containing an API key for a particular user. This is stored
 * separately from the {@link User} document to enhance security a bit.
 */
export default class ApiKey
  extends BaseDocument
  implements BaseDocumentWithUserId
{
  /**
   * The API key for the user. This is indexed in the DB.
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
    super();
    this.userId = userId;
  }
}
