import { DashboardTask, User } from '@aneuhold/core-ts-db-lib';
import { ObjectId } from 'bson';
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
