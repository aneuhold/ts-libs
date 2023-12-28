import { DashboardUserConfig } from '@aneuhold/core-ts-db-lib';
import DashboardBaseRepository from './DashboardBaseRepository';
import DashboardUserConfigValidator from '../../validators/dashboard/UserConfigValidator';
import CleanDocument from '../../util/DocumentCleaner';
import UserRepository from '../common/UserRepository';

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

  setupListeners(): void {
    UserRepository.getRepo().subscribeToChanges({
      deleteOne: async (userId) => {
        (await this.getCollection()).deleteOne({ userId });
      },
      deleteList: async (userIds) => {
        (await this.getCollection()).deleteMany({ userId: { $in: userIds } });
      },
      insertNew: async (user) => {
        if (user.projectAccess.dashboard) {
          await this.insertNew(new DashboardUserConfig(user._id));
        }
      }
    });
  }

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
}
