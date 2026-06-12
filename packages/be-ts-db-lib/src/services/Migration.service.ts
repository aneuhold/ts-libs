/* eslint-disable */
// @ts-nocheck
import { DR } from '@aneuhold/core-ts-lib';
import UserRepository from '../repositories/common/UserRepository.js';
import DashboardUserConfigRepository from '../repositories/dashboard/DashboardUserConfigRepository.js';

/**
 * The default values for enabledFeatures. New feature flags should be
 * added here and defaulted to `false`.
 */
const ENABLED_FEATURES_DEFAULTS = {
  financePage: false,
  automationPage: false,
  entertainmentPage: false,
  homePageLinks: false,
  useConfettiForTasks: false,
  catImageOnHomePage: false,
  adminPage: false
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
    DR.logger.info(`Starting migration... (dryRun=${dryRun})`);

    await this.migrateUserConfigs(dryRun);

    DR.logger.success('Migration complete.');
  }

  /**
   * Migrates dashboard user configs that are missing enableAdminPage
   * or the adminPage feature flag.
   */
  private static async migrateUserConfigs(dryRun: boolean): Promise<void> {
    const configRepo = DashboardUserConfigRepository.getRepo();
    const allConfigs = await configRepo.getAll();

    // Build a userId -> userName lookup
    const userRepo = UserRepository.getRepo();
    const allUsers = await userRepo.getAll();
    const userNameMap = new Map(allUsers.map((u) => [u._id, u.userName]));

    // Build all updates in memory first, tracking only changed fields
    const updates: Array<{
      configId: string;
      userName: string;
      changes: string[];
      updateDoc: Record<string, unknown>;
    }> = [];

    for (const config of allConfigs) {
      const changes: string[] = [];
      const updateDoc: Record<string, unknown> = { _id: config._id };

      if (config.enableAdminPage === undefined) {
        changes.push('enableAdminPage: undefined → false');
        updateDoc.enableAdminPage = false;
      }

      const existingFeatures = config.enabledFeatures ?? {};
      if (!existingFeatures || existingFeatures.adminPage === undefined) {
        changes.push('enabledFeatures.adminPage: undefined → false');
        updateDoc.enabledFeatures = { ...ENABLED_FEATURES_DEFAULTS, ...existingFeatures };
      }

      if (changes.length === 0) {
        continue;
      }

      const userName = userNameMap.get(config.userId) ?? 'unknown';
      updates.push({ configId: config._id, userName, changes, updateDoc });
    }

    DR.logger.info(
      `Found ${updates.length} of ${allConfigs.length} user configs needing admin page fields.`
    );

    if (updates.length === 0) {
      DR.logger.success('No user config migration needed.');
      return;
    }

    // Log exactly what will change
    for (const update of updates) {
      DR.logger.info(`  ${update.userName} (${update.configId}):`);
      for (const change of update.changes) {
        DR.logger.info(`    ${change}`);
      }
    }

    if (dryRun) {
      DR.logger.info(`Dry run complete. ${updates.length} configs would be updated.`);
      return;
    }

    // Execute updates
    for (const update of updates) {
      await configRepo.update(update.updateDoc);
      DR.logger.info(`Updated config for ${update.userName} (${update.configId})`);
    }

    DR.logger.success(
      `User config migration complete. Updated ${updates.length} configs.`
    );
  }
}
