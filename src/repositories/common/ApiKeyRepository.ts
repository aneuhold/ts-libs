import { ApiKey } from '@aneuhold/core-ts-db-lib';
import BaseRepository from '../BaseRepository';
import ApiKeyValidator from '../../validators/common/ApiKeyValidator';
import UserRepository from './UserRepository';

/**
 * The repository that contains {@link User} documents.
 */
export default class ApiKeyRepository extends BaseRepository<ApiKey> {
  private static COLLECTION_NAME = 'apiKeys';

  private static singletonInstance: ApiKeyRepository;

  private constructor() {
    super(ApiKeyRepository.COLLECTION_NAME, new ApiKeyValidator());
  }

  setupListeners(): void {
    UserRepository.getRepo().subscribeToChanges({
      deleteOne: async (userId) => {
        (await this.getCollection()).deleteOne({ userId });
      },
      deleteList: async (userIds) => {
        (await this.getCollection()).deleteMany({ userId: { $in: userIds } });
      },
      insertNew: async (user) => {
        await this.insertNew(new ApiKey(user._id));
      }
    });
  }

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
