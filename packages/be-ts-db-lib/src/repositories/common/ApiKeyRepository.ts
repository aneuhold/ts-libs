import { ApiKey, User } from '@aneuhold/core-ts-db-lib';
import { RepoListeners } from '../../services/RepoSubscriptionService.js';
import ApiKeyValidator from '../../validators/common/ApiKeyValidator.js';
import BaseRepository from '../BaseRepository.js';

/**
 * The repository that contains {@link ApiKey} documents.
 */
export default class ApiKeyRepository extends BaseRepository<ApiKey> {
  private static COLLECTION_NAME = 'apiKeys';

  private static singletonInstance: ApiKeyRepository | undefined;

  static getListenersForUserRepo(): RepoListeners<User> {
    const apiKeyRepo = ApiKeyRepository.getRepo();
    return {
      deleteOne: async (userId) => {
        await (
          await apiKeyRepo.getCollection()
        ).deleteOne({
          userId
        });
      },
      deleteList: async (userIds) => {
        await (
          await apiKeyRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds }
        });
      },
      insertNew: async (user) => {
        await apiKeyRepo.insertNew(new ApiKey(user._id));
      },
      insertMany: async (users) => {
        await apiKeyRepo.insertMany(users.map((user) => new ApiKey(user._id)));
      }
    };
  }

  private constructor() {
    super(ApiKeyRepository.COLLECTION_NAME, new ApiKeyValidator());
  }

  protected setupSubscribers(): void {}

  /**
   * Gets the singleton instance of the {@link ApiKeyRepository}.
   */
  public static getRepo(): ApiKeyRepository {
    if (!ApiKeyRepository.singletonInstance) {
      ApiKeyRepository.singletonInstance = new ApiKeyRepository();
    }
    return ApiKeyRepository.singletonInstance;
  }
}
