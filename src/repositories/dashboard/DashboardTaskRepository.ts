import {
  DashboardTask,
  DashboardTaskService,
  User
} from '@aneuhold/core-ts-db-lib';
import { ObjectId } from 'bson';
import { DeleteResult } from 'mongodb';
import DashboardBaseRepository from './DashboardBaseRepository';
import CleanDocument from '../../util/DocumentCleaner';
import { RepoListeners } from '../../services/RepoSubscriptionService';
import DashboardTaskValidator from '../../validators/dashboard/TaskValidator';
import DashboardUserConfigRepository from './DashboardUserConfigRepository';

/**
 * The repository that contains {@link DashboardTask} documents.
 */
export default class DashboardTaskRepository extends DashboardBaseRepository<DashboardTask> {
  private static singletonInstance?: DashboardTaskRepository;

  private constructor() {
    super(
      DashboardTask.docType,
      new DashboardTaskValidator(),
      (task: Partial<DashboardTask>) => {
        const docCopy = CleanDocument.userId(task);
        delete docCopy.createdDate;
        docCopy.lastUpdatedDate = new Date();
        return docCopy;
      }
    );
  }

  /**
   * Doesn't handle removing sharedWith references, as that should be handled
   * by the User Config updates.
   */
  static getListenersForUserRepo(): RepoListeners<User> {
    const taskRepo = DashboardTaskRepository.getRepo();
    return {
      deleteOne: async (userId) => {
        const taskCollection = await taskRepo.getCollection();
        // Remove all tasks for the user
        await taskCollection.deleteMany({ userId });
        // Remove all assignedTo references for the user
        await taskCollection.updateMany(
          { assignedTo: userId },
          { $set: { assignedTo: undefined } }
        );
      },
      deleteList: async (userIds) => {
        const taskCollection = await taskRepo.getCollection();
        // Remove all tasks for the users
        await taskCollection.deleteMany({
          userId: { $in: userIds }
        });
        // Remove all assignedTo references for the users
        await taskCollection.updateMany(
          { assignedTo: { $in: userIds } },
          { $set: { assignedTo: undefined } }
        );
      }
    };
  }

  protected setupSubscribers(): void {}

  /**
   * Gets the singleton instance of the {@link DashboardTaskRepository}.
   */
  public static getRepo() {
    if (!DashboardTaskRepository.singletonInstance) {
      DashboardTaskRepository.singletonInstance = new DashboardTaskRepository();
    }
    return DashboardTaskRepository.singletonInstance;
  }

  /**
   * Deletes a task and removes the reference to this task from any other tasks
   * that have it as a parent.
   *
   * @override
   */
  async delete(docId: ObjectId): Promise<DeleteResult> {
    const docIdsToDelete = await this.getAllTaskIDsToDelete([docId]);
    const deleteResult = await super.deleteList(docIdsToDelete);
    return deleteResult;
  }

  /**
   * Deletes a list of tasks and all children of those tasks.
   *
   * @override
   */
  async deleteList(docIds: ObjectId[]): Promise<DeleteResult> {
    const docIdsToDelete = await this.getAllTaskIDsToDelete(docIds);
    const result = await super.deleteList(docIdsToDelete);
    return result;
  }

  /**
   * Gets all tasks for a given user. Only the tasks that are owned by the user
   * or shared with the user, while they have the user ID as a collaborator,
   * will be returned.
   *
   * @param userId The ID of the user to get tasks for.
   */
  async getAllForUser(userId: ObjectId): Promise<DashboardTask[]> {
    const userConfigRepo = DashboardUserConfigRepository.getRepo();
    const userConfig = await userConfigRepo.get({ userId });
    if (!userConfig) {
      return [];
    }
    const { collaborators } = userConfig;
    const collection = await this.getCollection();
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
    return result as DashboardTask[];
  }

  /**
   * Gets all the task IDs that need to be deleted if the provided list of
   * tasks is deleted.
   */
  private async getAllTaskIDsToDelete(taskIds: ObjectId[]) {
    if (taskIds.length === 0) {
      return taskIds;
    }
    const initialTask = await this.get({ _id: taskIds[0] });
    if (!initialTask) {
      return taskIds;
    }
    const allUserTasks = await this.getAllForUser(initialTask.userId);
    const childrenIds = DashboardTaskService.getChildrenIds(
      allUserTasks,
      taskIds
    );
    return [...taskIds, ...childrenIds];
  }
}
