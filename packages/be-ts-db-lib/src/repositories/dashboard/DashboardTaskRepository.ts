import type { DashboardTask, User } from '@aneuhold/core-ts-db-lib';
import { DashboardTask_docType, DashboardTaskService } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { BulkWriteResult, DeleteResult, UpdateResult } from 'mongodb';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import CleanDocument from '../../util/DocumentCleaner.js';
import DashboardTaskValidator from '../../validators/dashboard/TaskValidator.js';
import DashboardBaseWithUserIdRepository from './DashboardBaseWithUserIdRepository.js';
import DashboardUserConfigRepository from './DashboardUserConfigRepository.js';

/**
 * The repository that contains {@link DashboardTask} documents.
 */
export default class DashboardTaskRepository extends DashboardBaseWithUserIdRepository<DashboardTask> {
  private static singletonInstance?: DashboardTaskRepository;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    super(DashboardTask_docType, new DashboardTaskValidator(), (task: Partial<DashboardTask>) => {
      const docCopy = CleanDocument.userId(task);
      delete docCopy.createdDate;
      docCopy.lastUpdatedDate = new Date();
      return docCopy;
    });
  }

  /**
   * Doesn't handle removing sharedWith references, as that should be handled
   * by the User Config updates.
   *
   * @returns The repository listeners for user repository.
   */
  static getListenersForUserRepo(): RepoListeners<User> {
    const taskRepo = DashboardTaskRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await taskRepo.deleteAllForUserWithCleanup(userId, meta);
      },
      deleteList: async (userIds, meta) => {
        await taskRepo.deleteAllForUsersWithCleanup(userIds, meta);
      }
    };
  }

  protected setupSubscribers(): void {}

  /**
   * Gets the singleton instance of the {@link DashboardTaskRepository}.
   *
   * @returns The singleton instance of the repository.
   */
  public static getRepo(): DashboardTaskRepository {
    if (!DashboardTaskRepository.singletonInstance) {
      DashboardTaskRepository.singletonInstance = new DashboardTaskRepository();
    }
    return DashboardTaskRepository.singletonInstance;
  }

  override async insertNew(
    newDoc: DashboardTask,
    meta?: DbOperationMetaData
  ): Promise<DashboardTask | null> {
    const result = await super.insertNew(newDoc, meta);
    if (result && meta) {
      meta.addAffectedUserIds(result.sharedWith);
    }
    return result;
  }

  override async insertMany(
    newDocs: DashboardTask[],
    meta?: DbOperationMetaData
  ): Promise<DashboardTask[]> {
    const result = await super.insertMany(newDocs, meta);
    if (meta && result.length > 0) {
      const sharedWithUsers = result.flatMap((task) => task.sharedWith);
      meta.addAffectedUserIds(sharedWithUsers);
    }
    return result;
  }

  override async update(
    updatedDoc: Partial<DashboardTask>,
    meta?: DbOperationMetaData
  ): Promise<UpdateResult> {
    if (meta && updatedDoc._id) {
      const docs = await this.fetchAndCacheDocsForMeta([updatedDoc._id], meta);
      if (docs.length > 0) {
        meta.addAffectedUserIds(docs[0].sharedWith);
      }
    }
    return super.update(updatedDoc, meta);
  }

  override async updateMany(
    updatedDocs: Partial<DashboardTask>[],
    meta?: DbOperationMetaData
  ): Promise<BulkWriteResult> {
    if (meta && updatedDocs.length > 0) {
      const docIds = updatedDocs.map((doc) => doc._id).filter((id): id is UUID => id !== undefined);
      const cachedDocs = await this.fetchAndCacheDocsForMeta(docIds, meta);
      const sharedWithUsers = cachedDocs.flatMap((task) => task.sharedWith);
      meta.addAffectedUserIds(sharedWithUsers);
    }
    return super.updateMany(updatedDocs, meta);
  }

  /**
   * Deletes a task and removes the reference to this task from any other tasks
   * that have it as a parent.
   *
   * @param docId The ID of the document to delete.
   * @param meta Tracks database operation metadata for a single request.
   * @returns The result of the delete operation.
   */
  override async delete(docId: UUID, meta?: DbOperationMetaData): Promise<DeleteResult> {
    const docIdsToDelete = await this.getAllTaskIDsToDelete([docId]);

    // Fetch and cache all tasks before deletion to report sharedWith users
    if (meta && docIdsToDelete.length > 0) {
      const tasksToDelete = await this.fetchAndCacheDocsForMeta(docIdsToDelete, meta);
      const sharedWithUsers = tasksToDelete.flatMap((task) => task.sharedWith);
      meta.addAffectedUserIds(sharedWithUsers);
    }

    const deleteResult = await super.deleteList(docIdsToDelete, meta);
    return deleteResult;
  }

  /**
   * Deletes a list of tasks and all children of those tasks.
   *
   * @param docIds The IDs of the documents to delete.
   * @param meta Tracks database operation metadata for a single request.
   * @returns The result of the delete operation.
   */
  override async deleteList(docIds: UUID[], meta?: DbOperationMetaData): Promise<DeleteResult> {
    const docIdsToDelete = await this.getAllTaskIDsToDelete(docIds);

    // Fetch and cache all tasks before deletion to report sharedWith users
    if (meta && docIdsToDelete.length > 0) {
      const tasksToDelete = await this.fetchAndCacheDocsForMeta(docIdsToDelete, meta);
      const sharedWithUsers = tasksToDelete.flatMap((task) => task.sharedWith);
      meta.addAffectedUserIds(sharedWithUsers);
    }

    const result = await super.deleteList(docIdsToDelete, meta);
    return result;
  }

  /**
   * Gets all tasks for a given user. Only the tasks that are owned by the user
   * or shared with the user, while they have the user ID as a collaborator,
   * will be returned.
   *
   * @param userId The ID of the user to get tasks for.
   * @returns The list of tasks for the user.
   */
  override async getAllForUser(userId: UUID): Promise<DashboardTask[]> {
    const userConfigRepo = DashboardUserConfigRepository.getRepo();
    const userConfig = await userConfigRepo.get({ userId });
    if (!userConfig) {
      return [];
    }
    const { collaborators } = userConfig;
    const collection = await DashboardTaskRepository.getRepo().getCollection();
    const filter = {
      $and: [
        this.getFilterWithDefault(),
        {
          $or: [
            { userId },
            {
              $and: [{ sharedWith: userId }, { userId: { $in: collaborators } }]
            }
          ]
        }
      ]
    };
    const result = await collection.find(filter).toArray();
    return result;
  }

  /**
   * Gets all the task IDs that need to be deleted if the provided list of
   * tasks is deleted.
   *
   * @param taskIds The IDs of the tasks to delete.
   * @returns The list of task IDs to delete.
   */
  private async getAllTaskIDsToDelete(taskIds: UUID[]): Promise<UUID[]> {
    if (taskIds.length === 0) {
      return taskIds;
    }
    const initialTask = await this.get({ _id: taskIds[0] });
    if (!initialTask) {
      return taskIds;
    }
    const allUserTasks = await this.getAllForUser(initialTask.userId);
    const childrenIds = DashboardTaskService.getChildrenIds(allUserTasks, taskIds);
    return [...taskIds, ...childrenIds];
  }

  /**
   * Deletes all tasks for a user and cleans up assignedTo references.
   *
   * @param userId - The user ID to delete tasks for.
   * @param meta - Tracks database operation metadata for a single request.
   */
  async deleteAllForUserWithCleanup(userId: UUID, meta?: DbOperationMetaData): Promise<void> {
    await this.deleteAllForUsersWithCleanup([userId], meta);
  }

  /**
   * Deletes all tasks for users and cleans up assignedTo references.
   *
   * @param userIds - The user IDs to delete tasks for.
   * @param meta - Tracks database operation metadata for a single request.
   */
  async deleteAllForUsersWithCleanup(userIds: UUID[], meta?: DbOperationMetaData): Promise<void> {
    const taskCollection = await this.getCollection();

    // Get all tasks owned by the users to report sharedWith users
    if (meta) {
      const tasksOwnedByUsers = await taskCollection
        .find({ userId: { $in: userIds }, docType: DashboardTask_docType })
        .toArray();
      tasksOwnedByUsers.forEach((task) => {
        meta.addAffectedUserIds(task.sharedWith);
      });
    }

    // Delete all tasks for the users
    await this.deleteAllForUsers(userIds, meta);

    // Remove all assignedTo references for the users
    await taskCollection.updateMany(
      { assignedTo: { $in: userIds }, docType: DashboardTask_docType },
      { $set: { assignedTo: undefined } }
    );
  }
}
