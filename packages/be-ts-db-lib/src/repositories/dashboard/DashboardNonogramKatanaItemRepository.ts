import type { NonogramKatanaItem, User } from '@aneuhold/core-ts-db-lib';
import { NonogramKatanaItem_docType } from '@aneuhold/core-ts-db-lib';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import DashboardNonogramKatanaItemValidator from '../../validators/dashboard/NonogramKatanaItemValidator.js';
import DashboardBaseWithUserIdRepository from './DashboardBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link NonogramKatanaItem} documents.
 */
export default class DashboardNonogramKatanaItemRepository extends DashboardBaseWithUserIdRepository<NonogramKatanaItem> {
  private static singletonInstance?: DashboardNonogramKatanaItemRepository;

  private constructor() {
    super(NonogramKatanaItem_docType, new DashboardNonogramKatanaItemValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const nonogramKatanaRepo = DashboardNonogramKatanaItemRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await (
          await nonogramKatanaRepo.getCollection()
        ).deleteMany({
          userId,
          docType: NonogramKatanaItem_docType
        });
        meta?.recordDocTypeTouched(NonogramKatanaItem_docType);
        meta?.addAffectedUserIds([userId]);
      },
      deleteList: async (userIds, meta) => {
        await (
          await nonogramKatanaRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds },
          docType: NonogramKatanaItem_docType
        });
        meta?.recordDocTypeTouched(NonogramKatanaItem_docType);
        meta?.addAffectedUserIds(userIds);
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
}
