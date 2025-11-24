/* eslint-disable */
// @ts-nocheck
import {
  ApiKey,
  DashboardTask,
  DashboardUserConfig,
  DocumentService,
  NonogramKatanaItem,
  NonogramKatanaUpgrade,
  User
} from '@aneuhold/core-ts-db-lib';
import { DR } from '@aneuhold/core-ts-lib';
import { v7 as uuidv7 } from 'uuid';
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

    DR.logger.info(
      `Loaded ${users.length} users, ${apiKeys.length} API keys, ${tasks.length} tasks, ${configs.length} configs, ${nonogramItems.length} nonogram items, and ${nonogramUpgrades.length} nonogram upgrades.`
    );

    const countObjectIds = (docs: any[]) => {
      docs.forEach((doc) => {
        // Get the type of the _id field
        console.log(`Document ID type: ${typeof doc._id}, value: ${doc._id}`);
      });
    };

    // Create a map of document IDs to new UUIDs
    const allDocs = [
      ...users,
      ...apiKeys,
      ...tasks,
      ...configs,
      ...nonogramItems,
      ...nonogramUpgrades
    ];
    const legacyDocs = allDocs.filter((doc) => typeof doc._id === 'object');
    const newDocs = allDocs.filter((doc) => typeof doc._id === 'string');

    DR.logger.info(
      `Found ${legacyDocs.length} documents with legacy ObjectId IDs and ${newDocs.length} documents with string IDs.`
    );

    // Now create the actual map
    const mapFromObjectIdToUUID = new Map<string, string>();
    newDocs.forEach((doc) => {
      if (!doc.oldOId) {
        DR.logger.warn(`Document with string ID ${doc._id} is missing oldOId field.`);
        return;
      }
      mapFromObjectIdToUUID.set(doc.oldOId, doc._id);
    });
    DR.logger.info(`Created mapping for ${mapFromObjectIdToUUID.size} documents.`);

    const newUsersToCreate: User[] = [];
    const newApiKeysToCreate: ApiKey[] = [];
    const newTasksToCreate: DashboardTask[] = [];
    const newConfigsToCreate: DashboardUserConfig[] = [];
    const newNonogramItemsToCreate: NonogramKatanaItem[] = [];
    const newNonogramUpgradesToCreate: NonogramKatanaUpgrade[] = [];

    /**
     * Gets a UUID for a given legacy ObjectId. If one already exists in the map,
     * it is returned. Otherwise, a new one is generated and added to the map.
     */
    const getUUID = (oldId: ObjectId): string => {
      const oldIdStr = oldId.toString();
      if (mapFromObjectIdToUUID.has(oldIdStr)) {
        return mapFromObjectIdToUUID.get(oldIdStr);
      }
      const newId = uuidv7();
      mapFromObjectIdToUUID.set(oldIdStr, newId);
      return newId;
    };

    // Create the function that will flesh out new documents for a given user document
    function createNewDocsForUser(oldUserDoc: User) {
      const oldUserIdStr = oldUserDoc._id.toString();
      if (mapFromObjectIdToUUID.has(oldUserIdStr)) {
        DR.logger.warn(
          `User document with ObjectId ID ${oldUserDoc._id} already has a mapped UUID in the DB. Skipping creation.`
        );
        // I might want to create these anyway at some point. Still deciding.
        return;
      }

      console.log('did it get here?')

      function createNewDoc(oldDoc) {
        if (mapFromObjectIdToUUID.has(oldDoc._id.toString())) return;
        const newDocId = getUUID(oldDoc._id);
        const newDoc = DocumentService.deepCopy(oldDoc);
        newDoc._id = newDocId;
        newDoc.oldOId = oldDoc._id.toString();
        return newDoc;
      }

      // 1. Create the new user document
      const newUser = createNewDoc(oldUserDoc);
      if (newUser) {
        newUsersToCreate.push(newUser);
      }

      const newUserId = getUUID(oldUserDoc._id);

      // 2. Create new API keys
      const userApiKeys = apiKeys.filter((k) => k.userId.toString() === oldUserIdStr);
      userApiKeys.forEach((oldKey) => {
        const newKey = createNewDoc(oldKey);
        if (!newKey) return;
        newKey.userId = newUserId;
        newApiKeysToCreate.push(newKey);
      });

      // 3. Create new Tasks
      const userTasks = tasks.filter(
        (t) => t.userId.toString() === oldUserIdStr
      );

      const taskChildrenMap = new Map<string, DashboardTask[]>();
      const rootTasks: DashboardTask[] = [];
      const userTaskIds = new Set(userTasks.map((t) => t._id.toString()));

      userTasks.forEach((task) => {
        const pId = task.parentTaskId?.toString();
        if (pId && userTaskIds.has(pId)) {
          if (!taskChildrenMap.has(pId)) {
            taskChildrenMap.set(pId, []);
          }
          taskChildrenMap.get(pId)!.push(task);
        } else {
          rootTasks.push(task);
        }
      });

      const queue = [...rootTasks];
      while (queue.length > 0) {
        const oldTask = queue.shift()!;
        const newTask = createNewDoc(oldTask);

        if (newTask) {
          newTask.userId = newUserId;

          // Map user IDs in tags keys
          const newTags: any = {};
          Object.keys(oldTask.tags).forEach((tagUserId) => {
            const newTagUserId = getUUID(tagUserId);
            newTags[newTagUserId] = oldTask.tags[tagUserId];
          });
          newTask.tags = newTags;

          // Map user IDs in filterSettings keys
          const newFilterSettings: any = {};
          Object.keys(oldTask.filterSettings).forEach((fsUserId) => {
            const newFsUserId = getUUID(fsUserId);
            newFilterSettings[newFsUserId] = oldTask.filterSettings[fsUserId];
          });
          newTask.filterSettings = newFilterSettings;

          // Map user IDs in sortSettings keys
          const newSortSettings: any = {};
          Object.keys(oldTask.sortSettings).forEach((ssUserId) => {
            const newSsUserId = getUUID(ssUserId);
            newSortSettings[newSsUserId] = oldTask.sortSettings[ssUserId];
          });
          newTask.sortSettings = newSortSettings;

          newTask.sharedWith = oldTask.sharedWith.map((id: any) => getUUID(id));
          if (oldTask.assignedTo) {
            newTask.assignedTo = getUUID(oldTask.assignedTo);
          }
          if (oldTask.parentTaskId) {
            newTask.parentTaskId = getUUID(oldTask.parentTaskId);
          }

          newTasksToCreate.push(newTask);
        }

        const children = taskChildrenMap.get(oldTask._id.toString());
        if (children) {
          queue.push(...children);
        }
      }

      // 4. Create new Configs
      const userConfigs = configs.filter((c) => c.userId.toString() === oldUserIdStr);
      userConfigs.forEach((oldConfig) => {
        const newConfig = createNewDoc(oldConfig);
        if (!newConfig) return;
        newConfig.userId = newUserId;
        newConfig.collaborators = oldConfig.collaborators.map((id: any) => getUUID(id));
        newConfigsToCreate.push(newConfig);
      });

      // 5. Nonogram Items
      const userNonogramItems = nonogramItems.filter((i) => i.userId.toString() === oldUserIdStr);
      userNonogramItems.forEach((oldItem) => {
        const newItem = createNewDoc(oldItem);
        if (!newItem) return;
        newItem.userId = newUserId;
        newNonogramItemsToCreate.push(newItem);
      });

      // 6. Nonogram Upgrades
      const userNonogramUpgrades = nonogramUpgrades.filter((u) => u.userId.toString() === oldUserIdStr);
      userNonogramUpgrades.forEach((oldUpgrade) => {
        const newUpgrade = createNewDoc(oldUpgrade);
        if (!newUpgrade) return;
        newUpgrade.userId = newUserId;
        newNonogramUpgradesToCreate.push(newUpgrade);
      });
    }

    // Run the creation function for a single user to test
    const legacyUsers = users.filter((u) => u.userName === 'demoUser1' && typeof u._id === 'object');
    legacyUsers.forEach((u) => createNewDocsForUser(u));

    DR.logger.info(`Prepped ${newUsersToCreate.length} new users.`);
    DR.logger.info(`Prepped ${newApiKeysToCreate.length} new API keys.`);
    DR.logger.info(`Prepped ${newTasksToCreate.length} new tasks.`);
    DR.logger.info(`Prepped ${newConfigsToCreate.length} new configs.`);
    DR.logger.info(
      `Prepped ${newNonogramItemsToCreate.length} new nonogram items.`
    );
    DR.logger.info(
      `Prepped ${newNonogramUpgradesToCreate.length} new nonogram upgrades.`
    );
    DR.logger.info(`In total, prepped ${
      newUsersToCreate.length +
      newApiKeysToCreate.length +
      newTasksToCreate.length +
      newConfigsToCreate.length +
      newNonogramItemsToCreate.length +
      newNonogramUpgradesToCreate.length
    } documents for insertion.`);

    if (!dryRun) {
      DR.logger.info('Dry run is false. Inserting documents into DB...');
      if (newUsersToCreate.length > 0) {
        await (await userRepo.getCollection()).insertMany(newUsersToCreate);
      }
      if (newApiKeysToCreate.length > 0) {
        await (await apiKeyRepo.getCollection()).insertMany(newApiKeysToCreate);
      }
      if (newTasksToCreate.length > 0) {
        await (await taskRepo.getCollection()).insertMany(newTasksToCreate);
      }
      if (newConfigsToCreate.length > 0) {
        await (await configRepo.getCollection()).insertMany(newConfigsToCreate);
      }
      if (newNonogramItemsToCreate.length > 0) {
        await (
          await nonogramItemRepo.getCollection()
        ).insertMany(newNonogramItemsToCreate);
      }
      if (newNonogramUpgradesToCreate.length > 0) {
        await (
          await nonogramUpgradesRepo.getCollection()
        ).insertMany(newNonogramUpgradesToCreate);
      }
      DR.logger.info('Insertion complete.');
    } else {
      DR.logger.info('Dry run is true. Skipping DB insertion.');
    }

    return;
  }

  // We started with 1204 docs
}
