/* eslint-disable */
// @ts-nocheck
import { DR } from '@aneuhold/core-ts-lib';
import { ObjectId } from 'bson';
import { v7 as uuidv7 } from 'uuid';
import UserRepository from '../repositories/common/UserRepository.js';
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
    return;
    DR.logger.info('Starting migration from ObjectId to UUID v7...');

    // 1. Load all documents
    const userRepo = UserRepository.getRepo();
    const taskRepo = DashboardTaskRepository.getRepo();
    const configRepo = DashboardUserConfigRepository.getRepo();

    const users = await userRepo.getAll();
    const tasks = await taskRepo.getAll();
    const configs = await configRepo.getAll();

    DR.logger.info(`Loaded ${users.length} users, ${tasks.length} tasks, ${configs.length} configs.`);

    // 2. Create ID Map (Old ObjectId string -> New UUID)
    const idMap = new Map<string, string>();
    let newIdCount = 0;

    const addToMap = (docs: any[]) => {
      docs.forEach((doc) => {
        if (doc._id instanceof ObjectId) {
          idMap.set(doc._id.toHexString(), uuidv7());
          newIdCount++;
        } else if (typeof doc._id === 'string' && !idMap.has(doc._id)) {
           // Already a string? Maybe already migrated or just a string ID.
           // If it looks like an ObjectId, map it.
           if (ObjectId.isValid(doc._id) && doc._id.length === 24) {
             idMap.set(doc._id, uuidv7());
             newIdCount++;
           }
        }
      });
    };

    addToMap(users);
    addToMap(tasks);
    addToMap(configs);

    DR.logger.info(`Generated ${newIdCount} new UUIDs.`);

    // 3. Helper to get new ID
    const getNewId = (oldId: any): string | undefined => {
      if (!oldId) return undefined;
      const oldIdStr = oldId.toString();
      return idMap.get(oldIdStr) || (typeof oldId === 'string' ? oldId : undefined);
    };

    // 4. Prepare New Documents
    const newUsers: any[] = [];
    const oldUserIds: ObjectId[] = [];

    const newTasks: any[] = [];
    const oldTaskIds: ObjectId[] = [];

    const newConfigs: any[] = [];
    const oldConfigIds: ObjectId[] = [];

    // --- Process Users ---
    for (const user of users) {
      if (user._id instanceof ObjectId) {
        const newId = getNewId(user._id);
        if (!newId) continue;

        const newUser = { ...user, _id: newId };
        // Users don't have many internal refs usually, but check if needed
        newUsers.push(newUser);
        oldUserIds.push(user._id);
      }
    }

    // --- Process Tasks ---
    for (const task of tasks) {
      if (task._id instanceof ObjectId) {
        const newId = getNewId(task._id);
        if (!newId) continue;

        const newTask = { ...task, _id: newId };

        // Fix userId
        if (newTask.userId) newTask.userId = getNewId(newTask.userId) || newTask.userId;

        // Fix assignedTo
        if (newTask.assignedTo) newTask.assignedTo = getNewId(newTask.assignedTo) || newTask.assignedTo;

        // Fix parentTaskId
        if (newTask.parentTaskId) newTask.parentTaskId = getNewId(newTask.parentTaskId) || newTask.parentTaskId;

        // Fix sharedWith array
        if (Array.isArray(newTask.sharedWith)) {
          newTask.sharedWith = newTask.sharedWith.map((id: any) => getNewId(id) || id);
        }

        // Fix tags keys (userIds are keys)
        if (newTask.tags) {
          const newTags: any = {};
          for (const [key, val] of Object.entries(newTask.tags)) {
            const newKey = getNewId(key) || key;
            newTags[newKey] = val;
          }
          newTask.tags = newTags;
        }
        
        // Fix filterSettings keys (userIds are keys)
        if (newTask.filterSettings) {
          const newSettings: any = {};
          for (const [key, val] of Object.entries(newTask.filterSettings)) {
            const newKey = getNewId(key) || key;
            newSettings[newKey] = val;
          }
          newTask.filterSettings = newSettings;
        }

        // Fix sortSettings keys (userIds are keys)
        if (newTask.sortSettings) {
          const newSettings: any = {};
          for (const [key, val] of Object.entries(newTask.sortSettings)) {
            const newKey = getNewId(key) || key;
            newSettings[newKey] = val;
          }
          newTask.sortSettings = newSettings;
        }

        newTasks.push(newTask);
        oldTaskIds.push(task._id);
      }
    }

    // --- Process UserConfigs ---
    for (const config of configs) {
      if (config._id instanceof ObjectId) {
        const newId = getNewId(config._id);
        if (!newId) continue;

        const newConfig = { ...config, _id: newId };

        // Fix userId
        if (newConfig.userId) newConfig.userId = getNewId(newConfig.userId) || newConfig.userId;

        // Fix collaborators
        if (Array.isArray(newConfig.collaborators)) {
          newConfig.collaborators = newConfig.collaborators.map((id: any) => getNewId(id) || id);
        }

        newConfigs.push(newConfig);
        oldConfigIds.push(config._id);
      }
    }

    // 5. Execute
    if (dryRun) {
      DR.logger.info(`[DRY RUN] Would insert ${newUsers.length} users and delete ${oldUserIds.length} old ones.`);
      DR.logger.info(`[DRY RUN] Would insert ${newTasks.length} tasks and delete ${oldTaskIds.length} old ones.`);
      DR.logger.info(`[DRY RUN] Would insert ${newConfigs.length} configs and delete ${oldConfigIds.length} old ones.`);
      return;
    }

    DR.logger.info('Executing migration...');

    // Users
    if (newUsers.length > 0) {
      await userRepo.insertMany(newUsers);
      await userRepo.deleteList(oldUserIds);
      DR.logger.success(`Migrated ${newUsers.length} users.`);
    }

    // Tasks
    if (newTasks.length > 0) {
      await taskRepo.insertMany(newTasks);
      await taskRepo.deleteList(oldTaskIds);
      DR.logger.success(`Migrated ${newTasks.length} tasks.`);
    }

    // Configs
    if (newConfigs.length > 0) {
      await configRepo.insertMany(newConfigs);
      await configRepo.deleteList(oldConfigIds);
      DR.logger.success(`Migrated ${newConfigs.length} configs.`);
    }

    DR.logger.success('Migration complete!');
  }
}
