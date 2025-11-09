import type { DashboardTaskMap } from '../../../documents/dashboard/Task.js';
import DashboardTask from '../../../documents/dashboard/Task.js';
import type { DashboardTaskListSortSettings } from '../../../embedded-types/dashboard/task/SortSettings.js';
import {
  DashboardTaskSortBy,
  DashboardTaskSortDirection
} from '../../../embedded-types/dashboard/task/SortSettings.js';
import type { DashboardTagSettings } from '../../../embedded-types/dashboard/userConfig/Tags.js';

/**
 * A service for sorting tasks.
 */
export default class DashboardTaskSortService {
  /**
   * Sorts the provided task IDs based on the provided sort settings.
   *
   * @param taskMap The map of tasks.
   * @param taskIds The IDs of the tasks to sort.
   * @param sortSettings The settings to sort by.
   * @param tagSettings The tag settings.
   * @returns The sorted task IDs.
   */
  static sort(
    taskMap: DashboardTaskMap,
    taskIds: string[],
    sortSettings: DashboardTaskListSortSettings,
    tagSettings: DashboardTagSettings
  ): string[] {
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
   *
   * @param taskMap The map of tasks.
   * @param taskIds The IDs of the tasks.
   * @param userId The user ID.
   * @param tagSettings The tag settings.
   * @param noPriorityTagsIndicator The indicator for no priority tags.
   * @param sortDirection The sort direction.
   * @returns A map of task IDs to tag header names.
   */
  static getTagHeaderMap(
    taskMap: DashboardTaskMap,
    taskIds: string[],
    userId: string,
    tagSettings: DashboardTagSettings,
    noPriorityTagsIndicator: string,
    sortDirection: DashboardTaskSortDirection
  ): Record<string, string> {
    const tagHeaderMap: Record<string, string> = {};
    if (taskIds.length === 0 || taskIds.length === 1) return tagHeaderMap;
    const firstTask = taskMap[taskIds[0]];
    if (!firstTask) return tagHeaderMap;
    let tag = this.getHighestPriorityTag(firstTask, userId, tagSettings, sortDirection);
    if (!tag) {
      tagHeaderMap[taskIds[0]] = noPriorityTagsIndicator;
    } else {
      tagHeaderMap[taskIds[0]] = tag;
    }
    for (let i = 1; i < taskIds.length; i += 1) {
      const task = taskMap[taskIds[i]];
      if (task) {
        const taskTag = this.getHighestPriorityTag(task, userId, tagSettings, sortDirection);
        if (taskTag !== tag && tag !== noPriorityTagsIndicator) {
          tag = taskTag || noPriorityTagsIndicator;
          tagHeaderMap[taskIds[i]] = tag;
        }
      }
    }
    return tagHeaderMap;
  }

  /**
   * Gets the task sort function based on the sort by and sort direction.
   *
   * @param sortBy The field to sort by.
   * @param sortDirection The direction to sort.
   * @param tagSettings The tag settings.
   * @param userId The user ID.
   * @returns A function that compares two tasks.
   */
  private static getTaskSortFunction(
    sortBy: DashboardTaskSortBy,
    sortDirection: DashboardTaskSortDirection,
    tagSettings: DashboardTagSettings,
    userId: string
  ): (taskA: DashboardTask, taskB: DashboardTask) => number {
    switch (sortBy) {
      case DashboardTaskSortBy.tags:
        return (taskA: DashboardTask, taskB: DashboardTask) => {
          const highestPriorityTagA = this.getHighestPriorityTagValue(
            taskA,
            userId,
            tagSettings,
            sortDirection
          );
          const highestPriorityTagB = this.getHighestPriorityTagValue(
            taskB,
            userId,
            tagSettings,
            sortDirection
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
   *
   * @param task The task.
   * @param userId The user ID.
   * @param tagSettings The tag settings.
   * @param sortDirection The sort direction.
   * @returns The highest priority tag or null.
   */
  private static getHighestPriorityTag(
    task: DashboardTask,
    userId: string,
    tagSettings: DashboardTagSettings,
    sortDirection: DashboardTaskSortDirection
  ): string | null {
    const priorityTag = this.getPriorityTagForTask(task, userId, tagSettings, sortDirection);
    return priorityTag ? priorityTag.tag : null;
  }

  /**
   * Gets the highest priority tag value for the provided task.
   *
   * @param task The task.
   * @param userId The user ID.
   * @param tagSettings The tag settings.
   * @param sortDirection The sort direction.
   * @returns The highest priority tag value.
   */
  private static getHighestPriorityTagValue(
    task: DashboardTask,
    userId: string,
    tagSettings: DashboardTagSettings,
    sortDirection: DashboardTaskSortDirection
  ): number {
    const priorityTag = this.getPriorityTagForTask(task, userId, tagSettings, sortDirection);
    return priorityTag ? priorityTag.priority : 0;
  }

  /**
   * Gets the priority tag for the provided task.
   *
   * @param task The task.
   * @param userId The user ID.
   * @param tagSettings The tag settings.
   * @param sortDirection The sort direction.
   * @returns The priority tag or null.
   */
  private static getPriorityTagForTask(
    task: DashboardTask,
    userId: string,
    tagSettings: DashboardTagSettings,
    sortDirection: DashboardTaskSortDirection
  ): { tag: string; priority: number } | null {
    let priorityTag: { tag: string; priority: number } | null = null;
    const tags = task.tags[userId];
    if (!tags || tags.length === 0) return priorityTag;

    let highestPriority = 0;
    const isAscending = sortDirection === DashboardTaskSortDirection.ascending;
    // If the sort direction is descending, then we want to start with the
    // lowest priority number.
    if (isAscending) {
      highestPriority = Number.MAX_SAFE_INTEGER;
    }
    tags.forEach((tag) => {
      const priority = tagSettings[tag]?.priority ?? 0;
      if (
        (isAscending && priority < highestPriority) ||
        (!isAscending && priority > highestPriority)
      ) {
        highestPriority = priority;
        priorityTag = { tag, priority };
      }
    });
    if (highestPriority === 0) {
      return null;
    }
    return priorityTag;
  }
}
