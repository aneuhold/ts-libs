import {
  DashboardUserConfig,
  validateDashboardUserConfig
} from '@aneuhold/core-ts-db-lib';
import { ErrorUtils, Logger } from '@aneuhold/core-ts-lib';
import { ObjectId } from 'bson';
import UserRepository from '../../repositories/common/UserRepository.js';
import DashboardUserConfigRepository from '../../repositories/dashboard/DashboardUserConfigRepository.js';
import IValidator from '../BaseValidator.js';

export default class DashboardUserConfigValidator extends IValidator<DashboardUserConfig> {
  async validateNewObject(newUserConfig: DashboardUserConfig): Promise<void> {
    // Check if the config already exists for the user
    const configRepo = DashboardUserConfigRepository.getRepo();
    const existingConfig = await configRepo.get({
      userId: newUserConfig.userId
    });
    if (existingConfig) {
      ErrorUtils.throwError(
        `Config already exists for user: ${newUserConfig.userId.toString()}`,
        newUserConfig
      );
    }
    const userRepo = UserRepository.getRepo();
    const user = await userRepo.get({ _id: newUserConfig.userId });
    if (!user) {
      ErrorUtils.throwError(
        `User does not exist: ${newUserConfig.userId.toString()}`,
        newUserConfig
      );
    }
    if (newUserConfig.collaborators.length > 0) {
      const collaborators = await userRepo.getList(newUserConfig.collaborators);
      if (collaborators.length !== newUserConfig.collaborators.length) {
        ErrorUtils.throwError(
          `Some collaborators not found. Expected ${newUserConfig.collaborators.length}, found ${collaborators.length}`,
          newUserConfig
        );
      }
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
    if (
      updatedUserConfig.collaborators &&
      updatedUserConfig.collaborators.length > 0
    ) {
      const userRepo = UserRepository.getRepo();
      const collaborators = await userRepo.getList(
        updatedUserConfig.collaborators
      );
      if (collaborators.length !== updatedUserConfig.collaborators.length) {
        ErrorUtils.throwError(
          `Some collaborators not found. Expected ${updatedUserConfig.collaborators.length}, found ${collaborators.length}`,
          updatedUserConfig
        );
      }
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
            `Dashboard User Config with ID: ${userConfig._id.toString()} has no valid associated user.`
          );
          return true;
        }
        return false;
      },
      documentValidator: (userConfig) => {
        const { updatedDoc, errors } = validateDashboardUserConfig(userConfig);
        const collaboratorIds = [...userConfig.collaborators];
        collaboratorIds.forEach((userId) => {
          if (!allUserIds[userId.toString()]) {
            errors.push(
              `User with ID: ${userId.toString()} does not exist in collaborators property of Dashboard User Config with ID: ${userConfig._id.toString()}.`
            );

            updatedDoc.collaborators = updatedDoc.collaborators.filter(
              (id) => id.toString() !== userId.toString()
            );
          }
        });
        return { updatedDoc, errors };
      },
      deletionFunction: async (docIdsToDelete: ObjectId[]) => {
        await userConfigRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: DashboardUserConfig[]) => {
        await userConfigRepo.updateMany(docsToUpdate);
      }
    });
  }
}
