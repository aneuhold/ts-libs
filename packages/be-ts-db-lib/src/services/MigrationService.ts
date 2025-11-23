/* eslint-disable */
// @ts-nocheck
import { DR } from '@aneuhold/core-ts-lib';
import type { User } from 'packages/core-ts-db-lib/lib/browser.js';
import ApiKeyRepository from '../repositories/common/ApiKeyRepository.js';
import UserRepository from '../repositories/common/UserRepository.js';
import DashboardNonogramKatanaItemRepository from '../repositories/dashboard/DashboardNonogramKatanaItemRepository.js';
import DashboardNonogramKatanaUpgradeRepository from '../repositories/dashboard/DashboardNonogramKatanaUpgradeRepository.js';
import DashboardTaskRepository from '../repositories/dashboard/DashboardTaskRepository.js';
import DashboardUserConfigRepository from '../repositories/dashboard/DashboardUserConfigRepository.js';

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

    // 1. Load all documents
    const userRepo = UserRepository.getRepo();
    const apiKeyRepo = ApiKeyRepository.getRepo();
    const taskRepo = DashboardTaskRepository.getRepo();
    const configRepo = DashboardUserConfigRepository.getRepo();
    const nonogramItemRepo = DashboardNonogramKatanaItemRepository.getRepo();
    const nonogramUpgradesRepo = DashboardNonogramKatanaUpgradeRepository.getRepo();

    const users = await userRepo.getAll();
    const apiKeys = await apiKeyRepo.getAll();
    const tasks = await taskRepo.getAll();
    const configs = await configRepo.getAll();
    const nonogramItems = await nonogramItemRepo.getAll();
    const nonogramUpgrades = await nonogramUpgradesRepo.getAll();

    DR.logger.info(`Loaded ${users.length} users, ${apiKeys.length} API keys, ${tasks.length} tasks, ${configs.length} configs, ${nonogramItems.length} nonogram items, and ${nonogramUpgrades.length} nonogram upgrades.`);
    
    const countObjectIds = (docs: any[]) => {
      docs.forEach((doc) => {
        // Get the type of the _id field
        console.log(`Document ID type: ${typeof doc._id}, value: ${doc._id}`);
      });
    };

    // Create a map of document IDs to new UUIDs
    const allDocs = [...users, ...apiKeys, ...tasks, ...configs, ...nonogramItems, ...nonogramUpgrades];
    const legacyDocs = allDocs.filter(doc => typeof doc._id === 'object');
    const newDocs = allDocs.filter(doc => typeof doc._id === 'string');

    DR.logger.info(`Found ${legacyDocs.length} documents with legacy ObjectId IDs and ${newDocs.length} documents with string IDs.`);

    // Now create the actual map
    const mapFromObjectIdToUUID = new Map<string, string>();
    newDocs.forEach(doc => {
      if (!doc.oldOId) {
        DR.logger.warn(`Document with string ID ${doc._id} is missing oldOId field.`);
      }
      mapFromObjectIdToUUID.set(doc.oldOId, doc._id);
    });
    DR.logger.info(`Created mapping for ${mapFromObjectIdToUUID.size} documents.`);

    // Create the function that will flesh out new documents for a given user document
    const newUsersToCreate: User[] = [];
    function createNewDocsForUser(oldUserDoc: User) {
      if (mapFromObjectIdToUUID.has(oldUserDoc._id.toString())) {
        DR.logger.warn(`User document with ObjectId ID ${oldUserDoc._id} already has a mapped UUID. Skipping creation.`);
        return;
      }
    }

    return;
  }
}
