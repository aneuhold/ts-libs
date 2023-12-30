import { ObjectId } from 'bson';
import BaseDocument from '../BaseDocument';
import { DocumentValidator } from '../../schemas/validators/DocumentValidator';
import Validate from '../../schemas/validators/ValidateUtil';

export const validateUser: DocumentValidator<User> = (user) => {
  const errors: string[] = [];
  const validate = new Validate(user, errors);
  const exampleUser = new User('example');

  validate.string('userName', 'UsernameUnknown');
  validate.optionalString('password');
  validate.optionalString('email');
  validate.object('auth', exampleUser.auth);
  validate.optionalString('auth.password');
  validate.optionalString('auth.googleId');
  validate.object('projectAccess', exampleUser.projectAccess);
  validate.boolean(
    'projectAccess.dashboard',
    exampleUser.projectAccess.dashboard
  );

  return { updatedDoc: user, errors };
};

/**
 * A standard user of all personal projects. This should be linked to from
 * other documents that need to reference a user, instead of cluttering the
 * key user information.
 */
export default class User extends BaseDocument {
  _id = new ObjectId();

  userName: string;

  email?: string;

  auth: {
    password?: string;
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
