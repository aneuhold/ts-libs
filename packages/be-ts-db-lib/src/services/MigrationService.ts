/* eslint-disable */
// @ts-nocheck
import { DR } from '@aneuhold/core-ts-lib';
import UserRepository from '../repositories/common/UserRepository.js';

/**
 * The default values for each project access field. New fields should be
 * added here and defaulted to `false` so existing users don't gain access
 * automatically.
 */
const PROJECT_ACCESS_DEFAULTS = {
  dashboard: false,
  workout: false
};

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

    // Find users that are missing projectAccess entirely or are missing
    // any of the expected fields.
    const usersToUpdate = users.filter((user) => {
      if (!user.projectAccess) return true;
      return Object.keys(PROJECT_ACCESS_DEFAULTS).some(
        (key) => user.projectAccess[key] === undefined
      );
    });

    DR.logger.info(
      `Found ${usersToUpdate.length} of ${users.length} users with missing projectAccess fields.`
    );

    if (usersToUpdate.length === 0) {
      DR.logger.success('No migration needed.');
      return;
    }

    if (dryRun) {
      DR.logger.info('Dry run: Would update the following users:');
      usersToUpdate.forEach((user) => {
        const existing = user.projectAccess ?? {};
        const merged = { ...PROJECT_ACCESS_DEFAULTS, ...existing };
        DR.logger.info(
          `  - ${user.userName} (${user._id}): ${JSON.stringify(existing)} → ${JSON.stringify(merged)}`
        );
      });
      return;
    }

    for (const user of usersToUpdate) {
      const existing = user.projectAccess ?? {};
      const merged = { ...PROJECT_ACCESS_DEFAULTS, ...existing };
      await userRepo.update({
        _id: user._id,
        projectAccess: merged
      });
      DR.logger.info(
        `Updated user ${user.userName} (${user._id}): ${JSON.stringify(existing)} → ${JSON.stringify(merged)}`
      );
    }

    DR.logger.success(`Migration complete. Updated ${usersToUpdate.length} users.`);
  }
}
