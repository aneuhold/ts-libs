import { DashboardTask, DashboardUserConfig } from '@aneuhold/core-ts-db-lib';
import { ObjectId } from 'bson';
import DashboardTaskRepository from '../../repositories/dashboard/DashboardTaskRepository.js';
import DashboardUserConfigRepository from '../../repositories/dashboard/DashboardUserConfigRepository.js';

/**
 * Dashboard-specific demo seeding utilities.
 */
export default class DashboardDemoAccountsService {
  /**
   * Seeds the dashboard demo data for two users. This will:
   * - Ensure both users have configs and are collaborators of each other
   * - Reset select config flags (enableDevMode, useConfettiForTasks, catImageOnHomePage)
   * - Wipe all tasks owned by either user
   * - Create example tasks (shared, nested, completed, with tags)
   *
   * Safe to re-run; will produce the same end state.
   *
   * @param demoUser1Id The first user
   * @param demoUser2Id The second user
   */
  static async seedDemoAccounts(demoUser1Id: ObjectId, demoUser2Id: ObjectId): Promise<void> {
    await this.ensureCollaboratorsAndResetConfig(demoUser1Id, demoUser2Id);
    await this.ensureCollaboratorsAndResetConfig(demoUser2Id, demoUser1Id);

    await this.wipeTasksForUsers([demoUser1Id, demoUser2Id]);

    await this.createExampleTasks(demoUser1Id, demoUser2Id);
    await this.createExampleTasks(demoUser2Id, demoUser1Id);
  }

  /**
   * Ensures user has a config with the collaborator, and resets specific flags.
   *
   * @param ownerId The config owner
   * @param collaboratorId The collaborator to include
   */
  private static async ensureCollaboratorsAndResetConfig(
    ownerId: ObjectId,
    collaboratorId: ObjectId
  ): Promise<void> {
    const cfgRepo = DashboardUserConfigRepository.getRepo();
    let cfg = await cfgRepo.getForUser(ownerId);
    let isNew = false;
    if (!cfg) {
      cfg = new DashboardUserConfig(ownerId);
      isNew = true;
    }
    // Ensure collaborator and reset flags
    cfg.collaborators = [collaboratorId];
    cfg.enableDevMode = true;
    cfg.enabledFeatures.useConfettiForTasks = true;
    cfg.enabledFeatures.catImageOnHomePage = false;
    if (isNew) {
      await cfgRepo.insertNew(cfg);
    } else {
      await cfgRepo.update(cfg);
    }
  }

  /**
   * Deletes all tasks owned by the provided users. Children are also removed
   * since they share the same owner.
   *
   * @param userIds The users to wipe tasks for
   */
  private static async wipeTasksForUsers(userIds: ObjectId[]): Promise<void> {
    const taskRepo = DashboardTaskRepository.getRepo();
    // Delete per-user using repo.deleteList to leverage child cleanup logic.
    for (const userId of userIds) {
      const allVisible = await taskRepo.getAllForUser(userId);
      const owned = allVisible.filter((t) => t.userId.equals(userId));
      if (owned.length === 0) continue;
      const ids = owned.map((t) => t._id);
      await taskRepo.deleteList(ids);
    }
  }

  /**
   * Creates a task if it doesn't exist (userId + title + optional parent used as key).
   *
   * @param ownerId The owning user ID
   * @param title The task title
   * @param opts Additional optional task properties
   * @param opts.description Description text
   * @param opts.completed Completion flag
   * @param opts.parentTaskId Parent task reference for subtasks
   * @param opts.sharedWith Users the task is shared with
   * @param opts.assignedTo The assigned user
   * @param opts.tags Tags for the owning user
   * @param opts.category System category
   */
  private static async ensureTask(
    ownerId: ObjectId,
    title: string,
    opts?: {
      description?: string;
      completed?: boolean;
      parentTaskId?: ObjectId;
      sharedWith?: ObjectId[];
      assignedTo?: ObjectId;
      tags?: string[];
      category?: string;
    }
  ): Promise<DashboardTask> {
    const taskRepo = DashboardTaskRepository.getRepo();
    const filter: Partial<DashboardTask> = { userId: ownerId, title };
    if (opts?.parentTaskId) {
      filter.parentTaskId = opts.parentTaskId;
    }
    const existing = await taskRepo.get(filter);
    if (existing) return existing;

    const task = new DashboardTask(ownerId);
    task.title = title;
    if (opts?.description) task.description = opts.description;
    if (opts?.completed !== undefined) task.completed = opts.completed;
    if (opts?.parentTaskId) task.parentTaskId = opts.parentTaskId;
    if (opts?.sharedWith) task.sharedWith = opts.sharedWith;
    if (opts?.assignedTo) task.assignedTo = opts.assignedTo;
    if (opts?.category) task.category = opts.category;
    task.tags[ownerId.toString()] = opts?.tags ?? [];

    const inserted = await taskRepo.insertNew(task);
    return inserted ?? task;
  }

  /**
   * Example data for each user.
   *
   * @param ownerId The owner of the example tasks
   * @param collaboratorId The collaborator to share tasks with
   */
  private static async createExampleTasks(ownerId: ObjectId, collaboratorId: ObjectId) {
    // Shared parent task with nested children
    const parent = await this.ensureTask(ownerId, 'Plan weekend trip', {
      description: 'Decide destination and plan activities for the weekend.',
      sharedWith: [collaboratorId],
      tags: ['planning', 'fun']
    });
    const child1 = await this.ensureTask(ownerId, 'Book hotel', {
      parentTaskId: parent._id,
      tags: ['booking']
    });
    await this.ensureTask(ownerId, 'Create itinerary', {
      parentTaskId: parent._id,
      tags: ['planning']
    });
    await this.ensureTask(ownerId, 'Pack bags', { parentTaskId: parent._id });
    await this.ensureTask(ownerId, 'Buy snacks', {
      parentTaskId: child1._id,
      completed: true,
      tags: ['food']
    });

    // Completed solo task
    await this.ensureTask(ownerId, 'Renew car registration', {
      completed: true,
      tags: ['admin']
    });

    // Shared task assigned to collaborator
    await this.ensureTask(ownerId, 'Buy groceries for BBQ', {
      sharedWith: [collaboratorId],
      assignedTo: collaboratorId,
      tags: ['home', 'bbq']
    });
  }
}
