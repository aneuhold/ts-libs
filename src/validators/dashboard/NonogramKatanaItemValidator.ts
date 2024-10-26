import {
  NonogramKatanaItem,
  validateNonogramKatanaItem
} from '@aneuhold/core-ts-db-lib';
import { ErrorUtils, Logger } from '@aneuhold/core-ts-lib';
import { ObjectId } from 'bson';
import UserRepository from '../../repositories/common/UserRepository.js';
import DashboardNonogramKatanaItemRepository from '../../repositories/dashboard/DashboardNonogramKatanaItemRepository.js';
import IValidator from '../BaseValidator.js';

export default class DashboardNonogramKatanaItemValidator extends IValidator<NonogramKatanaItem> {
  async validateNewObject(newItem: NonogramKatanaItem): Promise<void> {
    // Check if the item already exists for the user
    const itemRepo = DashboardNonogramKatanaItemRepository.getRepo();
    const existingItem = await itemRepo.get({
      userId: newItem.userId,
      itemName: newItem.itemName
    });
    if (existingItem) {
      ErrorUtils.throwError(
        `Nonogram Katana item already exists for user: ${newItem.userId.toString()}`,
        newItem
      );
    }
    const userRepo = UserRepository.getRepo();
    const user = await userRepo.get({ _id: newItem.userId });
    if (!user) {
      ErrorUtils.throwError(
        `User does not exist: ${newItem.userId.toString()}`,
        newItem
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async validateUpdateObject(
    updatedItem: Partial<NonogramKatanaItem>
  ): Promise<void> {
    // Check if an id is defined
    if (!updatedItem._id) {
      ErrorUtils.throwError(
        `No _id defined for NonogramKatanaItem update.`,
        updatedItem
      );
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const itemRepo = DashboardNonogramKatanaItemRepository.getRepo();
    const allItems = await itemRepo.getAll();
    const allUserIds = await UserRepository.getRepo().getAllIdsAsHash();

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'Nonogram Katana Item',
      allDocs: allItems,
      shouldDelete: (item: NonogramKatanaItem) => {
        if (!allUserIds[item.userId.toString()]) {
          Logger.error(
            `Nonogram Katana Item with ID: ${item._id.toString()} has no valid associated user.`
          );
          return true;
        }
        return false;
      },
      documentValidator: (item) => {
        const { updatedDoc, errors } = validateNonogramKatanaItem(item);
        return { updatedDoc, errors };
      },
      deletionFunction: async (docIdsToDelete: ObjectId[]) => {
        await itemRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: NonogramKatanaItem[]) => {
        await itemRepo.updateMany(docsToUpdate);
      }
    });
  }
}
