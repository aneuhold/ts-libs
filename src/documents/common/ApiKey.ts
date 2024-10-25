import { ObjectId } from 'bson';
import crypto, { UUID } from 'crypto';
import RequiredUserId from '../../schemas/required-refs/RequiredUserId.js';
import { DocumentValidator } from '../../schemas/validators/DocumentValidator.js';
import Validate from '../../schemas/validators/ValidateUtil.js';
import BaseDocument from '../BaseDocument.js';

export const validateApiKey: DocumentValidator<ApiKey> = (apiKey: ApiKey) => {
  const errors: string[] = [];
  const exampleApiKey = new ApiKey(new ObjectId());
  const validate = new Validate(apiKey, errors);

  validate.string('key', exampleApiKey.key);

  return { updatedDoc: apiKey, errors };
};

/**
 * A document containing an API key for a particular user. This is stored
 * separately from the {@link User} document to enhance security a bit.
 */
export default class ApiKey extends BaseDocument implements RequiredUserId {
  /**
   * The API key for the user. This is indexed in the DB.
   */
  key: UUID = crypto.randomUUID();

  /**
   * The user ID that this key is for. This field is indexed in the database.
   */
  userId: ObjectId;

  /**
   * Constructs a new {@link ApiKey} for the provided user.
   *
   * @param userId - The ID of the user.
   */
  constructor(userId: ObjectId) {
    super();
    this.userId = userId;
  }
}
