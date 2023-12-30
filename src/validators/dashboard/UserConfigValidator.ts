import { DashboardUserConfig } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
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

  validateRepositoryInDb(dryRun: boolean): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
