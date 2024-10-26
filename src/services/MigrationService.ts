/* eslint-disable */
// @ts-nocheck
import { Logger } from '@aneuhold/core-ts-lib';
import UserRepository from '../repositories/common/UserRepository.js';

/**
 * A service for migrating the DB to a new state after an existing document
 * change.
 *
 * This entire class is ignored from ESLint and TypeScript to allow for
 * manipulating the DB in any way necessary.
 */
export default class MigrationService {
  /**
   * A function that can be used to migrate the DB to a new state after an
   * existing document change.
   *
   * ❗️ BEWARE!!! ❗️
   * TRIPLE CHECK THAT THIS IS WHAT YOU WANT TO DO BEFORE RUNNING THIS FUNCTION.
   *
   * @param dryRun Whether or not to actually make the changes or just log them.
   */
  static async migrateDb(dryRun = false): Promise<void> {
    const userRepo = UserRepository.getRepo();
    const allUsers = (await userRepo.getAll()) as any;
    const updatedUsers = [];
    allUsers.forEach((user) => {
      if (user.password) {
        Logger.error(
          `User with ID: ${user._id} has a password in the wrong spot.`
        );
        user.auth.password = user.password;
        delete user.password;
        updatedUsers.push(user);
      }
    });
    if (dryRun) {
      if (updatedUsers.length > 0) {
        Logger.info(`Would update ${updatedUsers.length} users.`);
      } else {
        Logger.success('No changes to make.');
      }
      return;
    }
    if (updatedUsers.length > 0) {
      Logger.info(`Updating ${updatedUsers.length} users.`);
      await userRepo.updateMany(updatedUsers);
    } else {
      Logger.success('No changes to make.');
    }
  }
}
