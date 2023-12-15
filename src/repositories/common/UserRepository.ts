import { User } from '@aneuhold/core-ts-db-lib';
import BaseRepository from '../BaseRepository';
import UserValidator from '../../validators/common/UserValidator';

/**
 * The repository that contains {@link User} documents.
 */
export default class UserRepository extends BaseRepository<User> {
  private static COLLECTION_NAME = 'users';

  private static singletonInstance: UserRepository;

  private constructor() {
    super(UserRepository.COLLECTION_NAME, new UserValidator());
  }

  /**
   * Gets the singleton instance of the {@link UserRepository}.
   */
  public static getRepo() {
    if (!UserRepository.singletonInstance) {
      UserRepository.singletonInstance = new UserRepository();
    }
    return UserRepository.singletonInstance;
  }

  /**
   * Inserts a new user.
   *
   * This will add the default team that consists of just the user if it
   * doesn't already exist. If it does exist, it will add that team to the
   * user's {@link User.currentTeamsIncludingUser} array.
   *
   * @override
   *
   * @returns The user with the additional team, or null if the insert failed.
   */
  async insertNew(newUser: User): Promise<User | null> {
    // Insert the new user first
    const insertResult = await super.insertNew(newUser);
    if (!insertResult) {
      return null;
    }
    return newUser;
  }
}
