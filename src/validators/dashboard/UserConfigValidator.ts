import {
  DashboardUserConfig,
  validateDashboardUserConfig
} from '@aneuhold/core-ts-db-lib';
import { ErrorUtils, Logger } from '@aneuhold/core-ts-lib';
import { ObjectId } from 'bson';
import IValidator from '../BaseValidator';
import DashboardUserConfigRepository from '../../repositories/dashboard/DashboardUserConfigRepository';
import UserRepository from '../../repositories/common/UserRepository';

export default class DashboardUserConfigValidator extends IValidator<DashboardUserConfig> {
  async validateNewObject(newUserConfig: DashboardUserConfig): Promise<void> {
    // Check if the config already exists for the user
    const configRepo = DashboardUserConfigRepository.getRepo();
    const existingConfig = await configRepo.get({
      userId: newUserConfig.userId
    });
    if (existingConfig) {
      ErrorUtils.throwError(
        `Config already exists for user: ${newUserConfig.userId}`,
        newUserConfig
      );
    }
    const userRepo = UserRepository.getRepo();
    const user = await userRepo.get({ _id: newUserConfig.userId });
    if (!user) {
      ErrorUtils.throwError(
        `User does not exist: ${newUserConfig.userId}`,
        newUserConfig
      );
    }
  }

  async validateUpdateObject(
    updatedUserConfig: Partial<DashboardUserConfig>
  ): Promise<void> {
    // Check if an id is defined
    if (!updatedUserConfig._id) {
      ErrorUtils.throwError(
        `No _id defined for DashboardUserConfig update.`,
        updatedUserConfig
      );
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const userConfigRepo = DashboardUserConfigRepository.getRepo();
    const allUserConfigs = await userConfigRepo.getAll();
    const allUserIds = await UserRepository.getRepo().getAllIdsAsHash();

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'Dashboard User Config',
      allDocs: allUserConfigs,
      shouldDelete: (userConfig: DashboardUserConfig) => {
        if (!allUserIds[userConfig.userId.toString()]) {
          Logger.error(
            `Dashboard User Config with ID: ${userConfig._id} has no valid associated user.`
          );
          return true;
        }
        return false;
      },
      documentValidator: validateDashboardUserConfig,
      deletionFunction: async (docIdsToDelete: ObjectId[]) => {
        await userConfigRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: DashboardUserConfig[]) => {
        await userConfigRepo.updateMany(docsToUpdate);
      }
    });
  }
}
