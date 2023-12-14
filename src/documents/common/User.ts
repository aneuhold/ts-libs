import { ObjectId } from 'bson';
import BaseDocument from '../BaseDocument';

/**
 * A standard user of all personal projects. This should be linked to from
 * other documents that need to reference a user, instead of cluttering the
 * key user information.
 */
export default class User implements BaseDocument {
  _id = new ObjectId();

  userName: string;

  email?: string;

  auth: {
    googleId?: string;
  } = {};

  /**
   * Constructs a new {@link User} with default values.
   */
  constructor(userName: string) {
    this.userName = userName;
  }
}
