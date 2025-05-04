import { DashboardTask, validateDashboardTask } from '@aneuhold/core-ts-db-lib';
import { DR, ErrorUtils } from '@aneuhold/core-ts-lib';
import { ObjectId } from 'bson';
import UserRepository from '../../repositories/common/UserRepository.js';
import DashboardTaskRepository from '../../repositories/dashboard/DashboardTaskRepository.js';
import IValidator from '../BaseValidator.js';

export default class DashboardTaskValidator extends IValidator<DashboardTask> {
  async validateNewObject(newTask: DashboardTask): Promise<void> {
    const errors: string[] = [];
    // Check if the user exists, and any shared users exist
    const userRepo = UserRepository.getRepo();
    const userIds = [newTask.userId, ...newTask.sharedWith];
    const usersFound = await userRepo.getList(userIds);
    if (usersFound.length !== userIds.length) {
      errors.push(
        `Not all users exist. Found: ${usersFound.length}, expected: ${
          userIds.length
        }. List searched was: ${JSON.stringify(userIds)}.`
      );
    }
    // Do not check if it has a parent, becuase multiple could be inserted at
    // once and the parent may not exist yet.
    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, newTask);
    }
  }

  async validateUpdateObject(
    updatedTask: Partial<DashboardTask>
  ): Promise<void> {
    const errors: string[] = [];
    // Check if an id is defined
    if (!updatedTask._id) {
      errors.push(`No _id defined for DashboardTask update.`);
    }
    if (updatedTask.parentTaskId) {
      const parentTask = await DashboardTaskRepository.getRepo().get({
        _id: updatedTask.parentTaskId
      });
      if (!parentTask) {
        errors.push(
          `Parent task with ID: ${updatedTask.parentTaskId.toString()} does not exist.`
        );
      }
    }
    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedTask);
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
          DR.logger.error(
            `Dashboard Task with ID: ${task._id.toString()} has no valid associated owner (user).`
          );
          return true;
        }
        return false;
      },
      documentValidator: (task: DashboardTask) => {
        const { updatedDoc, errors } = validateDashboardTask(task);

        // Check sharedWith
        const sharedWithUserIds = [...task.sharedWith];
        sharedWithUserIds.forEach((userId) => {
          if (!allUserIds[userId.toString()]) {
            errors.push(
              `User with ID: ${userId.toString()} does not exist in sharedWith property of task with ID: ${task._id.toString()}.`
            );

            task.sharedWith = task.sharedWith.filter(
              (id) => id.toString() !== userId.toString()
            );
          }
        });

        // Check assignedTo
        if (task.assignedTo && !allUserIds[task.assignedTo.toString()]) {
          errors.push(
            `User with ID: ${task.assignedTo.toString()} does not exist in assignedTo property of task with ID: ${task._id.toString()}.`
          );
          updatedDoc.assignedTo = undefined;
        }

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
