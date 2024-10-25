import { ObjectId } from 'bson';
import DashboardTask, {
  DashboardTaskMap
} from '../../../documents/dashboard/Task.js';
import { DashboardTaskListFilterSettings } from '../../../embedded-types/dashboard/task/FilterSettings.js';
import { RecurrenceFrequency } from '../../../embedded-types/dashboard/task/RecurrenceInfo.js';
import {
  DashboardTaskListSortSettings,
  DashboardTaskSortDirection
} from '../../../embedded-types/dashboard/task/SortSettings.js';
import { DashboardTagSettings } from '../../../embedded-types/dashboard/userConfig/Tags.js';
import DashboardTaskFilterService, {
  DashboardTaskFilterResult
} from './TaskFilterService.js';
import DashboardTaskRecurrenceService from './TaskRecurrenceService.js';
import DashboardTaskSortService from './TaskSortService.js';

/**
 * A type for the task filter settings for a particular task.
 */
export type DashboardTaskFilterTaskInfo = {
  taskId: string;
  allChildrenIds: string[];
};

export type DashboardTaskFilterAndSortResult = {
  filteredAndSortedIds: string[];
  /**
   * The IDs of the tasks that were filtered, but still apply to the same
   * category. Does not include tasks that were filtered because of grand
   * children tasks.
   */
  removedIds: string[];
};

export default class DashboardTaskService {
  /**
   * Gets all the children task IDs for the given parent task IDs.
   *
   * @param allUserTasks - All tasks of the user.
   * @param parentTaskIds - The IDs of the parent tasks.
   * @returns An array of ObjectId representing the children task IDs.
   */
  static getChildrenIds = (
    allUserTasks: DashboardTask[],
    parentTaskIds: ObjectId[]
  ): ObjectId[] => {
    const parentToTaskIdsDict: Record<string, string[]> = {};
    const taskIdToTaskDict: Record<string, DashboardTask> = {};
    allUserTasks.forEach((task) => {
      taskIdToTaskDict[task._id.toString()] = task;
      if (task.parentTaskId) {
        if (!parentToTaskIdsDict[task.parentTaskId.toString()]) {
          parentToTaskIdsDict[task.parentTaskId.toString()] = [];
        }
        parentToTaskIdsDict[task.parentTaskId.toString()].push(
          task._id.toString()
        );
      }
    });
    const childrenIds: ObjectId[] = [];
    parentTaskIds.forEach((taskId) => {
      const task = taskIdToTaskDict[taskId.toString()];
      if (task) {
        const childrenTaskIds = this.getChildrenTaskIds(
          taskIdToTaskDict,
          parentToTaskIdsDict,
          taskId.toString()
        );
        childrenIds.push(...childrenTaskIds.map((id) => new ObjectId(id)));
      }
    });
    return childrenIds;
  };

  /**
   * Gets the next frequency date from the provided basis date. Returns null
   * if the provided frequency is in an invalid state.
   *
   * @param basisDate - The basis date to calculate the next frequency date.
   * @param frequency - The recurrence frequency.
   * @returns The next frequency date or null if the frequency is invalid.
   */
  static getNextFrequencyDate(
    basisDate: Date,
    frequency: RecurrenceFrequency
  ): Date | null {
    return DashboardTaskRecurrenceService.getNextFrequencyDate(
      basisDate,
      frequency
    );
  }

  /**
   * Moves the start and due date forward by one frequency.
   *
   * This does not take into account the recurrence effect. That should be
   * handled on the frontend.
   *
   * Makes no changes if the state of the task is invalid for recurrence or
   * there isn't recurrence info.
   *
   * @param task - The task to update dates for.
   */
  static updateDatesForRecurrence(task: DashboardTask): void {
    DashboardTaskRecurrenceService.updateDatesForRecurrence(task);
  }

  /**
   * Gets the filtered and sorted set of task ids for a particular category.
   *
   * @param taskMap - The map of tasks.
   * @param category - The category of the tasks to filter.
   * @param filterSettings - The filter settings for a task.
   * @param sortSettings - The sort settings for the tasks.
   * @param tagSettings - The tag settings for the user.
   * @param taskInfo - Optional task info for filtering.
   * @returns The filtered and sorted task IDs and the removed task IDs.
   */
  static getFilteredAndSortedTaskIds(
    taskMap: DashboardTaskMap,
    category: string,
    filterSettings: DashboardTaskListFilterSettings,
    sortSettings: DashboardTaskListSortSettings,
    tagSettings: DashboardTagSettings,
    taskInfo?: DashboardTaskFilterTaskInfo
  ): DashboardTaskFilterAndSortResult {
    let filterResult: DashboardTaskFilterResult;

    if (!taskInfo) {
      filterResult = DashboardTaskFilterService.filter(
        taskMap,
        Object.keys(taskMap),
        filterSettings,
        category
      );
    } else {
      filterResult = DashboardTaskFilterService.filter(
        taskMap,
        taskInfo.allChildrenIds,
        filterSettings,
        category,
        taskInfo.taskId
      );
    }
    return {
      filteredAndSortedIds: DashboardTaskSortService.sort(
        taskMap,
        filterResult.resultIds,
        sortSettings,
        tagSettings
      ),
      removedIds: filterResult.removedIds
    };
  }

  /**
   * Gets a map of task IDs to tag header names. Used only for when sorting by
   * tags. If the first task in the list has no high-priority tags, then
   * noPriorityTagsIndicator will be used as the header name.
   *
   * @param taskMap - The map of tasks.
   * @param taskIds - The IDs of the tasks.
   * @param userId - The ID of the user.
   * @param tagSettings - The tag settings for the user.
   * @param noPriorityTagsIndicator - The indicator for no priority tags.
   * @param sortDirection - The direction to sort the tasks.
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
    return DashboardTaskSortService.getTagHeaderMap(
      taskMap,
      taskIds,
      userId,
      tagSettings,
      noPriorityTagsIndicator,
      sortDirection
    );
  }

  /**
   * Gets all the children task IDs for a given task ID.
   *
   * @param taskIdToTaskDict - A dictionary mapping task IDs to tasks.
   * @param parentToTaskIdsDict - A dictionary mapping parent task IDs to their children task IDs.
   * @param taskId - The ID of the task to get children for.
   * @returns An array of strings representing the children task IDs.
   */
  private static getChildrenTaskIds(
    taskIdToTaskDict: Record<string, DashboardTask>,
    parentToTaskIdsDict: Record<string, string[]>,
    taskId: string
  ): string[] {
    const childrenIds = parentToTaskIdsDict[taskId];
    if (!childrenIds) {
      return [];
    }
    childrenIds.forEach((childId) => {
      const childTask = taskIdToTaskDict[childId];
      if (childTask) {
        const grandchildrenIds = this.getChildrenTaskIds(
          taskIdToTaskDict,
          parentToTaskIdsDict,
          childId
        );
        childrenIds.push(...grandchildrenIds);
      }
    });
    return childrenIds;
  }
}
