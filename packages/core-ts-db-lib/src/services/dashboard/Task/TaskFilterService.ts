import type { UUID } from 'crypto';
import type { DashboardTaskMap } from '../../../documents/dashboard/Task.js';
import type { DashboardTaskListFilterSettings } from '../../../embedded-types/dashboard/task/FilterSettings.js';

export type DashboardTaskFilterResult = {
  /**
   * The IDs of the tasks that satisfy the filter settings.
   */
  resultIds: UUID[];
  /**
   * The IDs of the tasks that were filtered, but still apply to the same
   * category. Does not include tasks that were filtered because of grand
   * children tasks.
   */
  removedIds: UUID[];
};

/**
 * A service responsible for filtering tasks based on provided settings.
 */
export default class DashboardTaskFilterService {
  /**
   * Filters the provided task ids based on the provided filter settings.
   *
   * This should filter first based on the most common cases, or faster-to-check
   * cases, then the less common or more heavy cases later on to increase
   * performance.
   *
   * @param taskMap - The map of tasks to use for filtering. This is used so that
   * the task map doesn't need to be generated multiple times.
   * @param taskIds - The IDs of the tasks to be filtered.
   * @param settings - The filter settings to apply.
   * @param category - The category to filter tasks by.
   * @param parentTaskId - (Optional) Determines if the current list is for a parent task
   * or not.
   * @returns An object containing the IDs of the tasks that satisfy the filter settings
   * (`resultIds`) and the IDs of the tasks that were filtered but still apply to the same
   * category (`removedIds`).
   */
  static filter(
    taskMap: DashboardTaskMap,
    taskIds: UUID[],
    settings: DashboardTaskListFilterSettings,
    category: string,
    parentTaskId?: UUID
  ): DashboardTaskFilterResult {
    // The filtered IDs that apply to the category, and aren't grandchildren
    // tasks.
    const removedIds: UUID[] = [];
    const resultIds = taskIds.filter((taskId) => {
      const task = taskMap[taskId];

      // Category
      if (!task || task.category !== category) return false;

      // Parent task
      // (the current list is only children tasks)
      if (parentTaskId) {
        if (
          !settings.grandChildrenTasks.show &&
          task.parentTaskId &&
          task.parentTaskId !== parentTaskId
        ) {
          return false;
        }
        // The list is all for a category, so filter out children tasks if needed.
      } else if (
        !settings.grandChildrenTasks.show &&
        task.parentTaskId &&
        taskMap[task.parentTaskId]
      ) {
        return false;
      }

      // Completed
      if (!settings.completed.show && task.completed) {
        return false;
      }

      // Start date
      if (!settings.startDate.showFutureTasks && task.startDate && task.startDate > new Date()) {
        removedIds.push(taskId);
        return false;
      }

      // Tags
      const tags = task.tags[settings.userId];
      if (tags && tags.length > 0) {
        const shouldHide = tags.some((tag) => {
          if (settings.tags[tag] && !settings.tags[tag].show) {
            return true;
          }
          return false;
        });
        if (shouldHide) {
          removedIds.push(taskId);
          return false;
        }
      }

      return true;
    });
    return {
      resultIds,
      removedIds
    };
  }
}
