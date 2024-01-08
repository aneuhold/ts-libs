import { User, UserCTO } from '@aneuhold/core-ts-db-lib';
import { ObjectId } from 'bson';
import BaseRepository from '../BaseRepository';
import UserValidator from '../../validators/common/UserValidator';
import ApiKeyRepository from './ApiKeyRepository';
import DashboardUserConfigRepository from '../dashboard/DashboardUserConfigRepository';
import DashboardTaskRepository from '../dashboard/DashboardTaskRepository';

/**
 * The repository that contains {@link User} documents.
 */
export default class UserRepository extends BaseRepository<User> {
  private static COLLECTION_NAME = 'users';

  private static singletonInstance: UserRepository;

  private constructor() {
    super(UserRepository.COLLECTION_NAME, new UserValidator());
  }

  protected setupSubscribers(): void {
    this.subscribeToChanges(ApiKeyRepository.getListenersForUserRepo());
    this.subscribeToChanges(
      DashboardUserConfigRepository.getListenersForUserRepo()
    );
    this.subscribeToChanges(DashboardTaskRepository.getListenersForUserRepo());
  }

  /**
   * Gets the singleton instance of the {@link UserRepository}.
   */
  static getRepo() {
    if (!UserRepository.singletonInstance) {
      UserRepository.singletonInstance = new UserRepository();
    }
    return UserRepository.singletonInstance;
  }

  async getUserCTOByUsername(userName: string): Promise<UserCTO | null> {
    const user = await this.get({ userName });
    if (user) {
      return {
        userName: user.userName,
        _id: user._id
      };
    }
    return null;
  }

  async getUserCTOsByIds(userIds: ObjectId[]): Promise<UserCTO[]> {
    const users = await this.getList(userIds);
    return users.map((user) => ({
      userName: user.userName,
      _id: user._id
    }));
  }
}
