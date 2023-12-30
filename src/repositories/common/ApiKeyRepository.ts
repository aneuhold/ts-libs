import { ApiKey, User } from '@aneuhold/core-ts-db-lib';
import BaseRepository from '../BaseRepository';
import ApiKeyValidator from '../../validators/common/ApiKeyValidator';
import { RepoListeners } from '../../services/RepoSubscriptionService';

/**
 * The repository that contains {@link ApiKey} documents.
 */
export default class ApiKeyRepository extends BaseRepository<ApiKey> {
  private static COLLECTION_NAME = 'apiKeys';

  private static singletonInstance: ApiKeyRepository;

  static getListenersForUserRepo(): RepoListeners<User> {
    const apiKeyRepo = ApiKeyRepository.getRepo();
    return {
      deleteOne: async (userId) => {
        (await apiKeyRepo.getCollection()).deleteOne({
          userId
        });
      },
      deleteList: async (userIds) => {
        (await apiKeyRepo.getCollection()).deleteMany({
          userId: { $in: userIds }
        });
      },
      insertNew: async (user) => {
        await apiKeyRepo.insertNew(new ApiKey(user._id));
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
  public static getRepo() {
    if (!ApiKeyRepository.singletonInstance) {
      ApiKeyRepository.singletonInstance = new ApiKeyRepository();
    }
    return ApiKeyRepository.singletonInstance;
  }
}
