import type { NonogramKatanaUpgrade, User } from '@aneuhold/core-ts-db-lib';
import { NonogramKatanaUpgrade_docType } from '@aneuhold/core-ts-db-lib';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import DashboardNonogramKatanaUpgradeValidator from '../../validators/dashboard/NonogramKatanaUpgradeValidator.js';
import DashboardBaseWithUserIdRepository from './DashboardBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link NonogramKatanaUpgrade} documents.
 */
export default class DashboardNonogramKatanaUpgradeRepository extends DashboardBaseWithUserIdRepository<NonogramKatanaUpgrade> {
  private static singletonInstance: DashboardNonogramKatanaUpgradeRepository | undefined;

  private constructor() {
    super(NonogramKatanaUpgrade_docType, new DashboardNonogramKatanaUpgradeValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const upgradeRepo = DashboardNonogramKatanaUpgradeRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await (
          await upgradeRepo.getCollection()
        ).deleteMany({
          userId,
          docType: NonogramKatanaUpgrade_docType
        });
        meta?.recordDocTypeTouched(NonogramKatanaUpgrade_docType);
        meta?.addAffectedUserIds([userId]);
      },
      deleteList: async (userIds, meta) => {
        await (
          await upgradeRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds },
          docType: NonogramKatanaUpgrade_docType
        });
        meta?.recordDocTypeTouched(NonogramKatanaUpgrade_docType);
        meta?.addAffectedUserIds(userIds);
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
}
