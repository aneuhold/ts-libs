import { DashboardTask, validateDashboardTask } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils, Logger } from '@aneuhold/core-ts-lib';
import { ObjectId } from 'bson';
import IValidator from '../BaseValidator';
import UserRepository from '../../repositories/common/UserRepository';
import DashboardTaskRepository from '../../repositories/dashboard/DashboardTaskRepository';

export default class DashboardTaskValidator extends IValidator<DashboardTask> {
  async validateNewObject(newTask: DashboardTask): Promise<void> {
    // Check if the user exists, and any shared users exist
    const userRepo = UserRepository.getRepo();
    const users = [newTask.userId, ...newTask.sharedWith];
    const usersFound = await userRepo.getList(users);
    if (usersFound.length !== users.length) {
      ErrorUtils.throwError(
        `Not all users exist. Found: ${usersFound.length}, expected: ${users.length}`,
        newTask
      );
    }
  }

  async validateUpdateObject(
    updatedTask: Partial<DashboardTask>
  ): Promise<void> {
    // Check if an id is defined
    if (!updatedTask._id) {
      ErrorUtils.throwError(
        `No _id defined for DashboardTask update.`,
        updatedTask
      );
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const taskRepo = DashboardTaskRepository.getRepo();
    const allTasks = await taskRepo.getAll();
    const allUserIds = await UserRepository.getRepo().getAllIdsAsHash();

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'Dashboard Task',
      allDocs: allTasks,
      shouldDelete: (task: DashboardTask) => {
        if (!allUserIds[task.userId.toString()]) {
          Logger.error(
            `Dashboard Task with ID: ${task._id} has no valid associated owner (user).`
          );
          return true;
        }
        return false;
      },
      documentValidator: (task: DashboardTask) => {
        const { updatedDoc, errors } = validateDashboardTask(task);
        const sharedWithUserIds = [...task.sharedWith];
        sharedWithUserIds.forEach((userId) => {
          if (!allUserIds[userId.toString()]) {
            errors.push(
              `User with ID: ${userId} does not exist in sharedWith property of task with ID: ${task._id}.`
            );
            // eslint-disable-next-line no-param-reassign
            task.sharedWith = task.sharedWith.filter(
              (id) => id.toString() !== userId.toString()
            );
          }
        });
        return { updatedDoc, errors };
      },
      deletionFunction: async (docIdsToDelete: ObjectId[]) => {
        await taskRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: DashboardTask[]) => {
        await taskRepo.updateMany(docsToUpdate);
      }
    });
  }
}
