import { ApiKey, DashboardUserConfig, User } from '@aneuhold/core-ts-db-lib';
import { DeleteResult } from 'mongodb';
import { ObjectId } from 'bson';
import BaseRepository from '../BaseRepository';
import UserValidator from '../../validators/common/UserValidator';
import ApiKeyRepository from './ApiKeyRepository';
import DashboardUserConfigRepository from '../dashboard/UserConfigRepository';

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
   * This will create a new API key for the user as well.
   *
   * @override
   */
  async insertNew(newUser: User): Promise<User | null> {
    const insertResult = await super.insertNew(newUser);
    if (!insertResult) {
      return null;
    }
    await ApiKeyRepository.getRepo().insertNew(new ApiKey(newUser._id));
    if (insertResult.projectAccess.dashboard) {
      await DashboardUserConfigRepository.getRepo().insertNew(
        new DashboardUserConfig(newUser._id)
      );
    }
    return newUser;
  }

  /**
   * Deletes a user.
   *
   * This will delete the API key for the user as well if there is one.
   *
   * @override
   */
  async delete(userId: ObjectId): Promise<DeleteResult> {
    const [deleteResult] = await Promise.all([
      super.delete(userId),
      ApiKeyRepository.getRepo().deleteByUserId(userId),
      DashboardUserConfigRepository.getRepo().deleteByUserId(userId)
    ]);
    return deleteResult;
  }

  /**
   * Deletes a list of users.
   *
   * This will delete the API keys for the users as well if there are any.
   *
   * @override
   */
  async deleteList(userIds: ObjectId[]): Promise<DeleteResult> {
    const [deleteResult] = await Promise.all([
      super.deleteList(userIds),
      ApiKeyRepository.getRepo().deleteByUserIds(userIds),
      DashboardUserConfigRepository.getRepo().deleteByUserIds(userIds)
    ]);
    return deleteResult;
  }

  /**
   * This should not be used except for testing purposes
   *
   * @override
   */
  async deleteAll(): Promise<DeleteResult> {
    const [deleteResult] = await Promise.all([
      super.deleteAll(),
      ApiKeyRepository.getRepo().deleteAll(),
      DashboardUserConfigRepository.getRepo().deleteAll()
    ]);
    return deleteResult;
  }
}
