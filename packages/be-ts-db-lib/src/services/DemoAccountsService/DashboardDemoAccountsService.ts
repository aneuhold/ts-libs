import { DashboardTask, DashboardUserConfig } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import DashboardTaskRepository from '../../repositories/dashboard/DashboardTaskRepository.js';
import DashboardUserConfigRepository from '../../repositories/dashboard/DashboardUserConfigRepository.js';

/**
 * Dashboard-specific demo seeding utilities.
 */
export default class DashboardDemoAccountsService {
  /**
   * Default priorities for known demo tags. If a tag is not listed here,
   * a fallback priority will be used.
   */
  private static readonly TAG_PRIORITY: Record<string, number> = {
    planning: 9,
    fun: 8,
    booking: 7,
    food: 6,
    home: 5,
    bbq: 4,
    admin: 3,
    paint: 2,
    electric: 1
  };

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
  static async seedDemoAccounts(demoUser1Id: UUID, demoUser2Id: UUID): Promise<void> {
    await this.ensureCollaboratorsAndResetConfig(demoUser1Id, demoUser2Id);
    await this.ensureCollaboratorsAndResetConfig(demoUser2Id, demoUser1Id);

    await this.wipeTasksForUsers([demoUser1Id, demoUser2Id]);

    // Create shared tasks (visible to both users) exactly once
    await this.createExampleTasks(demoUser1Id, demoUser2Id);
    // Create non-shared tasks for each user
    await this.createNonSharedTasks(demoUser1Id, demoUser2Id);
  }

  /**
   * Ensures user has a config with the collaborator, and resets specific flags.
   *
   * @param ownerId The config owner
   * @param collaboratorId The collaborator to include
   */
  private static async ensureCollaboratorsAndResetConfig(
    ownerId: UUID,
    collaboratorId: UUID
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
    // Reset tag settings and seed priorities for demo tags
    cfg.tagSettings = {};
    for (const [tag, priority] of Object.entries(this.TAG_PRIORITY)) {
      cfg.tagSettings[tag] = { priority };
    }
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
  private static async wipeTasksForUsers(userIds: UUID[]): Promise<void> {
    const taskRepo = DashboardTaskRepository.getRepo();
    // Delete per-user using repo.deleteList to leverage child cleanup logic.
    for (const userId of userIds) {
      const allVisible = await taskRepo.getAllForUser(userId);
      const owned = allVisible.filter((t) => t.userId === userId);
      if (owned.length === 0) continue;
      const ids = owned.map((t) => t._id);
      await taskRepo.deleteList(ids);
    }
  }

  /**
   * Creates a task owned by the specified user. Because we wipe all tasks
   * for the demo users prior to creation, we don't need to check for
   * existing tasks and can always insert.
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
   * @param opts.startDate Optional start date
   * @param opts.dueDate Optional due date
   * @param opts.category System category
   */
  private static async createTask(
    ownerId: UUID,
    title: string,
    opts?: {
      description?: string;
      completed?: boolean;
      parentTaskId?: UUID;
      sharedWith?: UUID[];
      assignedTo?: UUID;
      tags?: string[];
      startDate?: Date;
      dueDate?: Date;
      category?: string;
    }
  ): Promise<DashboardTask> {
    const taskRepo = DashboardTaskRepository.getRepo();
    const task = new DashboardTask(ownerId);
    task.title = title;
    if (opts?.description) task.description = opts.description;
    if (opts?.completed !== undefined) task.completed = opts.completed;
    if (opts?.parentTaskId) task.parentTaskId = opts.parentTaskId;
    if (opts?.sharedWith) task.sharedWith = opts.sharedWith;
    if (opts?.assignedTo) task.assignedTo = opts.assignedTo;
    if (opts?.category) task.category = opts.category;
    if (opts?.startDate) task.startDate = opts.startDate;
    if (opts?.dueDate) task.dueDate = opts.dueDate;
    task.tags[ownerId] = opts?.tags ?? [];

    const inserted = await taskRepo.insertNew(task);
    return inserted ?? task;
  }

  /**
   * Creates shared demo tasks visible to both users exactly once to avoid duplicates.
   *
   * @param user1Id The primary owner of some shared tasks
   * @param user2Id The collaborator for shared tasks
   */
  private static async createExampleTasks(user1Id: UUID, user2Id: UUID) {
    // Shared parent task (owned by user1, shared with user2)
    const parent = await this.createTask(user1Id, 'Plan weekend trip', {
      description: 'Decide destination and plan activities for the weekend.',
      sharedWith: [user2Id],
      tags: ['planning', 'fun']
    });
    const child1 = await this.createTask(user1Id, 'Book hotel', {
      parentTaskId: parent._id,
      tags: ['booking']
    });
    await this.createTask(user1Id, 'Create itinerary', {
      parentTaskId: parent._id,
      tags: ['planning']
    });
    await this.createTask(user1Id, 'Pack bags', { parentTaskId: parent._id });
    await this.createTask(user1Id, 'Buy snacks', {
      parentTaskId: child1._id,
      completed: true,
      tags: ['food']
    });

    // Shared task assigned to user2 (owned by user1)
    await this.createTask(user1Id, 'Buy groceries for BBQ', {
      sharedWith: [user2Id],
      assignedTo: user2Id,
      tags: ['home', 'bbq']
    });

    // A shared planning task owned by user2
    await this.createTask(user2Id, 'Plan potluck dinner', {
      sharedWith: [user1Id],
      assignedTo: user1Id,
      tags: ['food', 'planning']
    });
  }

  /**
   * Creates non-shared demo tasks for each user.
   *
   * @param user1Id The first user
   * @param user2Id The second user
   */
  private static async createNonSharedTasks(user1Id: UUID, user2Id: UUID) {
    const now = new Date();
    const futureDue = new Date(now.getTime());
    futureDue.setMonth(futureDue.getMonth() + 4);
    const pastDue = new Date(now.getTime());
    const pastDueStart = new Date(now.getTime());
    pastDue.setDate(pastDue.getDate() - 7);
    pastDueStart.setDate(pastDueStart.getDate() - 14);

    // User 1: A completed solo task
    await this.createTask(user1Id, 'Renew car registration', {
      completed: true,
      tags: ['admin']
    });

    // User 2: Own parent task with subtasks (not shared)
    const u2Parent = await this.createTask(user2Id, 'Home improvement project', {
      description: 'Small updates around the house.',
      tags: ['home']
    });
    await this.createTask(user2Id, 'Paint living room walls', {
      parentTaskId: u2Parent._id,
      completed: true,
      tags: ['paint']
    });
    await this.createTask(user2Id, 'Replace light fixtures', {
      parentTaskId: u2Parent._id,
      tags: ['electric']
    });

    // Root task with a future due date (>= 4 months out)
    await this.createTask(user1Id, 'Schedule annual physical', {
      description: 'Book an appointment and add to calendar.',
      dueDate: futureDue,
      tags: ['admin']
    });
    await this.createTask(user2Id, 'Schedule annual physical', {
      description: 'Book an appointment and add to calendar.',
      dueDate: futureDue,
      tags: ['admin']
    });

    // Past-due task
    await this.createTask(user1Id, 'Submit expense report', {
      description: 'Collect receipts and submit to finance.',
      startDate: pastDueStart,
      dueDate: pastDue,
      tags: ['admin']
    });
    await this.createTask(user2Id, 'Submit expense report', {
      description: 'Collect receipts and submit to finance.',
      startDate: pastDueStart,
      dueDate: pastDue,
      tags: ['admin']
    });
  }
}
