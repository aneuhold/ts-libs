import { ObjectId } from 'bson';
import BaseDocument from '../BaseDocument';

/**
 * A standard user of all personal projects. This should be linked to from
 * other documents that need to reference a user, instead of cluttering the
 * key user information.
 */
export default class User extends BaseDocument {
  _id = new ObjectId();

  userName: string;

  password?: string;

  email?: string;

  auth: {
    googleId?: string;
  } = {};

  projectAccess = {
    dashboard: true
  };

  /**
   * Constructs a new {@link User} with default values.
   */
  constructor(userName: string) {
    super();
    this.userName = userName;
  }
}
