import { DashboardUserConfig } from '@aneuhold/core-ts-db-lib';
import { ObjectId } from 'bson';
import { DeleteResult } from 'mongodb';
import DashboardBaseRepository from './DashboardBaseRepository';
import DashboardUserConfigValidator from '../../validators/dashboard/UserConfigValidator';
import CleanDocument from '../../util/DocumentCleaner';

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

  async deleteByUserId(userId: ObjectId): Promise<DeleteResult> {
    const collection = await this.getCollection();
    return collection.deleteOne({ userId });
  }

  async deleteByUserIds(userIds: ObjectId[]): Promise<DeleteResult> {
    const collection = await this.getCollection();
    return collection.deleteMany({ userId: { $in: userIds } });
  }
}
