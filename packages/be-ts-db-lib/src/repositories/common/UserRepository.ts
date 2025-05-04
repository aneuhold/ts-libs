import { User, UserCTO } from '@aneuhold/core-ts-db-lib';
import { ObjectId } from 'bson';
import UserValidator from '../../validators/common/UserValidator.js';
import BaseRepository from '../BaseRepository.js';
import DashboardNonogramKatanaItemRepository from '../dashboard/DashboardNonogramKatanaItemRepository.js';
import DashboardNonogramKatanaUpgradeRepository from '../dashboard/DashboardNonogramKatanaUpgradeRepository.js';
import DashboardTaskRepository from '../dashboard/DashboardTaskRepository.js';
import DashboardUserConfigRepository from '../dashboard/DashboardUserConfigRepository.js';
import ApiKeyRepository from './ApiKeyRepository.js';

/**
 * The repository that contains {@link User} documents.
 */
export default class UserRepository extends BaseRepository<User> {
  private static COLLECTION_NAME = 'users';

  private static singletonInstance: UserRepository | undefined;

  private constructor() {
    super(UserRepository.COLLECTION_NAME, new UserValidator());
  }

  protected setupSubscribers(): void {
    this.subscribeToChanges(ApiKeyRepository.getListenersForUserRepo());
    this.subscribeToChanges(
      DashboardUserConfigRepository.getListenersForUserRepo()
    );
    this.subscribeToChanges(DashboardTaskRepository.getListenersForUserRepo());
    this.subscribeToChanges(
      DashboardNonogramKatanaItemRepository.getListenersForUserRepo()
    );
    this.subscribeToChanges(
      DashboardNonogramKatanaUpgradeRepository.getListenersForUserRepo()
    );
  }

  /**
   * Gets the singleton instance of the {@link UserRepository}.
   */
  static getRepo(): UserRepository {
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
