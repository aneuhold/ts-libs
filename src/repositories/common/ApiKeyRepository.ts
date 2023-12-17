import { ApiKey } from '@aneuhold/core-ts-db-lib';
import { DeleteResult } from 'mongodb';
import { ObjectId } from 'bson';
import BaseRepository from '../BaseRepository';
import ApiKeyValidator from '../../validators/common/ApiKeyValidator';

/**
 * The repository that contains {@link User} documents.
 */
export default class ApiKeyRepository extends BaseRepository<ApiKey> {
  private static COLLECTION_NAME = 'apiKeys';

  private static singletonInstance: ApiKeyRepository;

  private constructor() {
    super(ApiKeyRepository.COLLECTION_NAME, new ApiKeyValidator());
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

  async deleteByUserId(userId: ObjectId): Promise<DeleteResult> {
    const collection = await this.getCollection();
    return collection.deleteOne({ userId });
  }

  async deleteByUserIds(userIds: ObjectId[]): Promise<DeleteResult> {
    const collection = await this.getCollection();
    return collection.deleteMany({ userId: { $in: userIds } });
  }
}
