import { NonogramKatanaUpgrade, User } from '@aneuhold/core-ts-db-lib';
import { ObjectId } from 'bson';
import { RepoListeners } from '../../services/RepoSubscriptionService.js';
import CleanDocument from '../../util/DocumentCleaner.js';
import DashboardNonogramKatanaUpgradeValidator from '../../validators/dashboard/NonogramKatanaUpgradeValidator.js';
import DashboardBaseRepository from './DashboardBaseRepository.js';

/**
 * The repository that contains {@link NonogramKatanaUpgrade} documents.
 */
export default class DashboardNonogramKatanaUpgradeRepository extends DashboardBaseRepository<NonogramKatanaUpgrade> {
  private static singletonInstance:
    | DashboardNonogramKatanaUpgradeRepository
    | undefined;

  private constructor() {
    super(
      NonogramKatanaUpgrade.docType,
      new DashboardNonogramKatanaUpgradeValidator(),
      CleanDocument.userId
    );
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const upgradeRepo = DashboardNonogramKatanaUpgradeRepository.getRepo();
    return {
      deleteOne: async (userId) => {
        await (await upgradeRepo.getCollection()).deleteMany({ userId });
      },
      deleteList: async (userIds) => {
        await (
          await upgradeRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds }
        });
      }
    };
  }

  protected setupSubscribers(): void {}

  /**
   * Gets the singleton instance of the {@link DashboardNonogramKatanaUpgradeRepository}.
   */
  public static getRepo(): DashboardNonogramKatanaUpgradeRepository {
    if (!DashboardNonogramKatanaUpgradeRepository.singletonInstance) {
      DashboardNonogramKatanaUpgradeRepository.singletonInstance =
        new DashboardNonogramKatanaUpgradeRepository();
    }
    return DashboardNonogramKatanaUpgradeRepository.singletonInstance;
  }

  /**
   * Gets all Nonogram Katana upgrades for a given user.
   *
   * @param userId The ID of the user to get upgrades for.
   */
  async getAllForUser(userId: ObjectId): Promise<NonogramKatanaUpgrade[]> {
    const collection = await this.getCollection();
    const filter = {
      $and: [this.getFilterWithDefault(), { userId }]
    };
    const result = await collection.find(filter).toArray();
    return result as NonogramKatanaUpgrade[];
  }
}
