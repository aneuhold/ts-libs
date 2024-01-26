import { DashboardTaskMap } from '../../../documents/dashboard/Task';
import { DashboardTaskListFilterSettings } from '../../../embedded-types/dashboard/task/FilterSettings';

export type DashboardTaskFilterResult = {
  /**
   * The IDs of the tasks that satisfy the filter settings.
   */
  resultIds: string[];
  /**
   * The IDs of the tasks that were filtered, but still apply to the same
   * category. Does not include tasks that were filtered because of grand
   * children tasks.
   */
  removedIds: string[];
};

/**
 * A service responsible for filtering
 */
export default class DashboardTaskFilterService {
  /**
   * Filters the provided task ids based on the provided filter settings.
   *
   * This should filter first based on the most common cases, or faster-to-check
   * cases, then the less common or more heavy cases later on to increase
   * performance.
   *
   * @param taskMap the map of tasks to use for filtering. This is used so that
   * the task map doesn't need to be generated multiple times.
   * @param parentTaskId determines if the current list is for a parent task
   * or not
   */
  static filter(
    taskMap: DashboardTaskMap,
    taskIds: string[],
    settings: DashboardTaskListFilterSettings,
    category: string,
    parentTaskId?: string
  ): DashboardTaskFilterResult {
    // The filtered IDs that apply to the category, and aren't grandchildren
    // tasks.
    const removedIds: string[] = [];
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
          task.parentTaskId.toString() !== parentTaskId
        ) {
          return false;
        }
        // The list is all for a category, so filter out children tasks if needed.
      } else if (
        !settings.grandChildrenTasks.show &&
        task.parentTaskId &&
        taskMap[task.parentTaskId.toString()]
      ) {
        return false;
      }

      // Completed
      if (!settings.completed.show && task.completed) {
        removedIds.push(taskId);
        return false;
      }

      // Start date
      if (
        !settings.startDate.showFutureTasks &&
        task.startDate &&
        task.startDate > new Date()
      ) {
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
          removedIds.push(taskId);
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
