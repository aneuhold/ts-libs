import { NonogramKatanaItem, User } from '@aneuhold/core-ts-db-lib';
import { ObjectId } from 'bson';
import { RepoListeners } from '../../services/RepoSubscriptionService.js';
import CleanDocument from '../../util/DocumentCleaner.js';
import DashboardNonogramKatanaItemValidator from '../../validators/dashboard/NonogramKatanaItemValidator.js';
import DashboardBaseRepository from './DashboardBaseRepository.js';

/**
 * The repository that contains {@link NonogramKatanaItem} documents.
 */
export default class DashboardNonogramKatanaItemRepository extends DashboardBaseRepository<NonogramKatanaItem> {
  private static singletonInstance?: DashboardNonogramKatanaItemRepository;

  private constructor() {
    super(
      NonogramKatanaItem.docType,
      new DashboardNonogramKatanaItemValidator(),
      CleanDocument.userId
    );
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const nonogramKatanaRepo = DashboardNonogramKatanaItemRepository.getRepo();
    return {
      deleteOne: async (userId) => {
        await (await nonogramKatanaRepo.getCollection()).deleteMany({ userId });
      },
      deleteList: async (userIds) => {
        await (
          await nonogramKatanaRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds }
        });
      }
    };
  }

  protected setupSubscribers(): void {}

  /**
   * Gets the singleton instance of the {@link DashboardNonogramKatanaItemRepository}.
   */
  public static getRepo(): DashboardNonogramKatanaItemRepository {
    if (!DashboardNonogramKatanaItemRepository.singletonInstance) {
      DashboardNonogramKatanaItemRepository.singletonInstance =
        new DashboardNonogramKatanaItemRepository();
    }
    return DashboardNonogramKatanaItemRepository.singletonInstance;
  }

  /**
   * Gets all Nonogram Katana items for a given user.
   *
   * @param userId The ID of the user to get items for.
   */
  async getAllForUser(userId: ObjectId): Promise<NonogramKatanaItem[]> {
    const collection = await this.getCollection();
    const filter = {
      $and: [this.getFilterWithDefault(), { userId }]
    };
    const result = await collection.find(filter).toArray();
    return result as NonogramKatanaItem[];
  }
}
