import {
  NonogramKatanaUpgrade,
  validateNonogramKatanaUpgrade
} from '@aneuhold/core-ts-db-lib';
import { DR, ErrorUtils } from '@aneuhold/core-ts-lib';
import { ObjectId } from 'bson';
import UserRepository from '../../repositories/common/UserRepository.js';
import DashboardNonogramKatanaUpgradeRepository from '../../repositories/dashboard/DashboardNonogramKatanaUpgradeRepository.js';
import IValidator from '../BaseValidator.js';

export default class DashboardNonogramKatanaUpgradeValidator extends IValidator<NonogramKatanaUpgrade> {
  async validateNewObject(newUpgrade: NonogramKatanaUpgrade): Promise<void> {
    // Check if the item already exists for the user
    const upgradeRepo = DashboardNonogramKatanaUpgradeRepository.getRepo();
    const existingItem = await upgradeRepo.get({
      userId: newUpgrade.userId,
      upgradeName: newUpgrade.upgradeName
    });
    if (existingItem) {
      ErrorUtils.throwError(
        `Nonogram Katana upgrade already exists for user: ${newUpgrade.userId.toString()}`,
        newUpgrade
      );
    }
    const userRepo = UserRepository.getRepo();
    const user = await userRepo.get({ _id: newUpgrade.userId });
    if (!user) {
      ErrorUtils.throwError(
        `User does not exist: ${newUpgrade.userId.toString()}`,
        newUpgrade
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async validateUpdateObject(
    updatedUpgrade: Partial<NonogramKatanaUpgrade>
  ): Promise<void> {
    // Check if an id is defined
    if (!updatedUpgrade._id) {
      ErrorUtils.throwError(
        `No _id defined for NonogramKatanaUpgrade update.`,
        updatedUpgrade
      );
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const upgradeRepo = DashboardNonogramKatanaUpgradeRepository.getRepo();
    const allUpgrades = await upgradeRepo.getAll();
    const allUserIds = await UserRepository.getRepo().getAllIdsAsHash();

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'Nonogram Katana Upgrade',
      allDocs: allUpgrades,
      shouldDelete: (upgrade: NonogramKatanaUpgrade) => {
        if (!allUserIds[upgrade.userId.toString()]) {
          DR.logger.error(
            `Nonogram Katana Upgrade with ID: ${upgrade._id.toString()} has no valid associated user.`
          );
          return true;
        }
        return false;
      },
      documentValidator: (upgrade) => {
        const { updatedDoc, errors } = validateNonogramKatanaUpgrade(upgrade);
        return { updatedDoc, errors };
      },
      deletionFunction: async (docIdsToDelete: ObjectId[]) => {
        await upgradeRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: NonogramKatanaUpgrade[]) => {
        await upgradeRepo.updateMany(docsToUpdate);
      }
    });
  }
}
