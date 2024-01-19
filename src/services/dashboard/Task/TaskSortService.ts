import DashboardTask, {
  DashboardTaskMap
} from '../../../documents/dashboard/Task';
import {
  DashboardTaskListSortSettings,
  DashboardTaskSortBy,
  DashboardTaskSortDirection
} from '../../../embedded-types/dashboard/task/SortSettings';
import { DashboardTagSettings } from '../../../embedded-types/dashboard/userConfig/Tags';

/**
 * A service for sorting tasks.
 */
export default class DashboardTaskSortService {
  /**
   * Sorts the provided task IDs based on the provided sort settings.
   */
  static sort(
    taskMap: DashboardTaskMap,
    taskIds: string[],
    sortSettings: DashboardTaskListSortSettings,
    tagSettings: DashboardTagSettings
  ) {
    return taskIds.sort((idA, idB) => {
      const taskA = taskMap[idA];
      const taskB = taskMap[idB];

      if (!taskA || !taskB || sortSettings.sortList.length === 0) return 0;

      for (const sortSetting of sortSettings.sortList) {
        const { sortBy } = sortSetting;
        const { sortDirection } = sortSetting;

        const result = this.getTaskSortFunction(
          sortBy,
          sortDirection,
          tagSettings,
          sortSettings.userId
        )(taskA, taskB);
        if (result !== 0) {
          return result;
        }
      }
      return 0;
    });
  }

  private static getTaskSortFunction(
    sortBy: DashboardTaskSortBy,
    sortDirection: DashboardTaskSortDirection,
    tagSettings: DashboardTagSettings,
    userId: string
  ) {
    switch (sortBy) {
      case DashboardTaskSortBy.tags:
        return (taskA: DashboardTask, taskB: DashboardTask) => {
          const highestPriorityTagA = this.getHighestPriorityTagValue(
            taskA,
            userId,
            tagSettings
          );
          const highestPriorityTagB = this.getHighestPriorityTagValue(
            taskB,
            userId,
            tagSettings
          );

          if (highestPriorityTagA === highestPriorityTagB) {
            return 0;
          }
          if (highestPriorityTagA > highestPriorityTagB) {
            return 1 * sortDirection;
          }
          return -1 * sortDirection;
        };
      case DashboardTaskSortBy.title:
        return (taskA: DashboardTask, taskB: DashboardTask) => {
          const titleA = taskA.title;
          const titleB = taskB.title;

          if (!titleA || !titleB) return 0;

          return titleA.localeCompare(titleB) * sortDirection;
        };
      default:
        return (taskA: DashboardTask, taskB: DashboardTask) => {
          const valueA = taskA[sortBy];
          const valueB = taskB[sortBy];

          if (!valueA && !valueB) return 0;
          if (valueA && !valueB) return 1 * sortDirection;
          if (!valueA && valueB) return -1 * sortDirection;

          if (!valueA || !valueB) return 0;

          if (valueA instanceof Date && valueB instanceof Date) {
            if (valueA.getTime() === valueB.getTime()) return 0;
            if (valueA.getTime() > valueB.getTime()) return 1 * sortDirection;
            if (valueA.getTime() < valueB.getTime()) return -1 * sortDirection;
            return 0;
          }

          if (valueA > valueB) return 1 * sortDirection;
          if (valueA < valueB) return -1 * sortDirection;
          return 0;
        };
    }
  }

  private static getHighestPriorityTagValue(
    task: DashboardTask,
    userId: string,
    tagSettings: DashboardTagSettings
  ) {
    const tags = task.tags[userId];
    if (!tags || tags.length === 0) return 0;

    return tags.reduce((highestPriority, tag) => {
      const priority = tagSettings[tag]?.priority;
      if (priority && priority > highestPriority) {
        return priority;
      }
      return highestPriority;
    }, 0);
  }
}
