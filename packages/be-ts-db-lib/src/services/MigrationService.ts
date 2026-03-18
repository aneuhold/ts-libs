/* eslint-disable */
// @ts-nocheck
import { DR } from '@aneuhold/core-ts-lib';
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
    DR.logger.info('Starting migration...');

    const userRepo = UserRepository.getRepo();
    const users = await userRepo.getAll();

    // Add refreshTokenHashes to users that don't have it yet
    const usersToUpdate = users.filter((user) => !user.auth.refreshTokenHashes);

    DR.logger.info(
      `Found ${usersToUpdate.length} of ${users.length} users missing auth.refreshTokenHashes.`
    );

    if (usersToUpdate.length === 0) {
      DR.logger.success('No migration needed.');
      return;
    }

    if (dryRun) {
      DR.logger.info('Dry run: Would update the following users:');
      usersToUpdate.forEach((user) => {
        DR.logger.info(`  - ${user.userName} (${user._id})`);
      });
      return;
    }

    for (const user of usersToUpdate) {
      await userRepo.update({
        _id: user._id,
        auth: { ...user.auth, refreshTokenHashes: [] }
      });
      DR.logger.info(`Updated user ${user.userName} (${user._id})`);
    }

    DR.logger.success(`Migration complete. Updated ${usersToUpdate.length} users.`);
  }
}
