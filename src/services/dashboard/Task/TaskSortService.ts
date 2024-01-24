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

  /**
   * Gets a map of task IDs to tag header names. Used only for when sorting by
   * tags. If the first task in the list has no high-priority tags, then
   * noPriorityTagsIndicator will be used as the header name.
   */
  static getTagHeaderMap(
    taskMap: DashboardTaskMap,
    taskIds: string[],
    userId: string,
    tagSettings: DashboardTagSettings,
    noPriorityTagsIndicator: string
  ): Record<string, string> {
    const tagHeaderMap: Record<string, string> = {};
    if (taskIds.length === 0 || taskIds.length === 1) return tagHeaderMap;
    const firstTask = taskMap[taskIds[0]];
    if (!firstTask) return tagHeaderMap;
    let tag = this.getHighestPriorityTag(firstTask, userId, tagSettings);
    if (!tag) {
      tagHeaderMap[taskIds[0]] = noPriorityTagsIndicator;
    } else {
      tagHeaderMap[taskIds[0]] = tag;
    }
    for (let i = 1; i < taskIds.length; i += 1) {
      const task = taskMap[taskIds[i]];
      if (task) {
        const taskTag = this.getHighestPriorityTag(task, userId, tagSettings);
        if (taskTag !== tag && tag !== noPriorityTagsIndicator) {
          tag = taskTag || noPriorityTagsIndicator;
          tagHeaderMap[taskIds[i]] = tag;
        }
      }
    }
    return tagHeaderMap;
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
          // One doesn't have a value, it should be sorted to the bottom.
          // Purposefully not using the sortDirection here.
          if (valueA && !valueB) return -1;
          if (!valueA && valueB) return 1;

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

  /**
   * Gets the highest priority tag for the provided task. If there are no tags,
   * or if there are no tags with a priority, then this will return null.
   */
  private static getHighestPriorityTag(
    task: DashboardTask,
    userId: string,
    tagSettings: DashboardTagSettings
  ): string | null {
    const tags = task.tags[userId];
    if (!tags || tags.length === 0) return null;

    let highestPriorityTag: string | null = null;
    let highestPriority = 0;
    tags.forEach((tag) => {
      const priority = tagSettings[tag]?.priority;
      if (priority && priority > highestPriority) {
        highestPriorityTag = tag;
        highestPriority = priority;
      }
    });
    return highestPriorityTag;
  }

  /**
   * Gets the highest priority tag value for the provided task.
   */
  static getHighestPriorityTagValue(
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
