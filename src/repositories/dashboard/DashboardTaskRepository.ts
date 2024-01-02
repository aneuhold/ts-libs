import { DashboardTask, User } from '@aneuhold/core-ts-db-lib';
import { ObjectId } from 'bson';
import { DeleteResult } from 'mongodb';
import DashboardBaseRepository from './DashboardBaseRepository';
import CleanDocument from '../../util/DocumentCleaner';
import { RepoListeners } from '../../services/RepoSubscriptionService';
import DashboardTaskValidator from '../../validators/dashboard/TaskValidator';

/**
 * The repository that contains {@link DashboardTask} documents.
 */
export default class DashboardTaskRepository extends DashboardBaseRepository<DashboardTask> {
  private static singletonInstance: DashboardTaskRepository;

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

  static getListenersForUserRepo(): RepoListeners<User> {
    const taskRepo = DashboardTaskRepository.getRepo();
    return {
      deleteOne: async (userId) => {
        await (await taskRepo.getCollection()).deleteOne({ userId });
      },
      deleteList: async (userIds) => {
        await (
          await taskRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds }
        });
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
    const result = await super.delete(docId);
    const collection = await this.getCollection();
    await collection.updateMany(
      { parentTaskId: docId },
      { $unset: { parentTaskId: '' } }
    );
    return result;
  }

  /**
   * Deletes a list of tasks and removes the reference to these tasks from
   * any other tasks that have them as a parent.
   *
   * @override
   */
  async deleteList(docIds: ObjectId[]): Promise<DeleteResult> {
    const result = await super.deleteList(docIds);
    const collection = await this.getCollection();
    await collection.updateMany(
      { parentTaskId: { $in: docIds } },
      { $unset: { parentTaskId: '' } }
    );
    return result;
  }

  /**
   * Gets all tasks for a given user.
   * @param userId The ID of the user to get tasks for.
   */
  async getAllForUser(userId: ObjectId): Promise<DashboardTask[]> {
    const collection = await this.getCollection();
    const filter = {
      $and: [
        this.getFilterWithDefault(),
        { $or: [{ userId }, { sharedWith: userId }] }
      ]
    };
    const result = await collection.find(filter).toArray();
    return result as DashboardTask[];
  }
}
