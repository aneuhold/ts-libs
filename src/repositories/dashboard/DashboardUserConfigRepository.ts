import { DashboardUserConfig, User } from '@aneuhold/core-ts-db-lib';
import { ObjectId } from 'bson';
import DashboardBaseRepository from './DashboardBaseRepository';
import DashboardUserConfigValidator from '../../validators/dashboard/UserConfigValidator';
import CleanDocument from '../../util/DocumentCleaner';
import { RepoListeners } from '../../services/RepoSubscriptionService';

/**
 * The repository that contains {@link DashboardUserConfig} documents.
 */
export default class DashboardUserConfigRepository extends DashboardBaseRepository<DashboardUserConfig> {
  private static singletonInstance: DashboardUserConfigRepository;

  private constructor() {
    super(
      DashboardUserConfig.docType,
      new DashboardUserConfigValidator(),
      CleanDocument.userId
    );
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const userConfigRepo = DashboardUserConfigRepository.getRepo();
    return {
      deleteOne: async (userId) => {
        await (await userConfigRepo.getCollection()).deleteOne({ userId });
      },
      deleteList: async (userIds) => {
        await (
          await userConfigRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds }
        });
      },
      insertNew: async (user) => {
        if (user.projectAccess.dashboard) {
          await userConfigRepo.insertNew(new DashboardUserConfig(user._id));
        }
      }
    };
  }

  protected setupSubscribers(): void {}

  /**
   * Gets the singleton instance of the {@link DashboardUserConfigRepository}.
   */
  public static getRepo() {
    if (!DashboardUserConfigRepository.singletonInstance) {
      DashboardUserConfigRepository.singletonInstance =
        new DashboardUserConfigRepository();
    }
    return DashboardUserConfigRepository.singletonInstance;
  }

  /**
   * Gets the config for a given user.
   * @param userId The ID of the user to get the config for.
   */
  async getForUser(userId: ObjectId): Promise<DashboardUserConfig | null> {
    const collection = await this.getCollection();
    const result = await collection.findOne({ userId });
    return result as DashboardUserConfig | null;
  }
}
