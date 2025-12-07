import type { UUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { type DashboardTask, DashboardTaskSchema } from '../../../documents/dashboard/Task.js';
import type { DashboardTaskListFilterSettings } from '../../../embedded-types/dashboard/task/FilterSettings.js';
import {
  RecurrenceBasis,
  RecurrenceEffect,
  type RecurrenceFrequency,
  RecurrenceFrequencyType
} from '../../../embedded-types/dashboard/task/RecurrenceInfo.js';
import {
  type DashboardTaskListSortSettings,
  DashboardTaskSortBy,
  DashboardTaskSortDirection
} from '../../../embedded-types/dashboard/task/SortSettings.js';
import type { DashboardTagSettings } from '../../../embedded-types/dashboard/userConfig/Tags.js';
import DocumentService from '../../DocumentService.js';
import DashboardTaskService from './TaskService.js';

describe('DashboardTaskService', () => {
  describe('getNextFrequencyDate', () => {
    it('should return a valid date for lastDayOfMonth', () => {
      const basisDate = new Date(2024, 0, 1);
      const frequency: RecurrenceFrequency = {
        type: RecurrenceFrequencyType.lastDayOfMonth
      };
      const result = DashboardTaskService.getNextFrequencyDate(basisDate, frequency);
      expect(result).toEqual(new Date(2024, 0, 31));
    });

    describe('every X time unit', () => {
      it('should return a valid date for every X Day', () => {
        const basisDate = new Date(2024, 0, 1);
        const frequency: RecurrenceFrequency = {
          type: RecurrenceFrequencyType.everyXTimeUnit,
          everyXTimeUnit: {
            timeUnit: 'day',
            x: 2
          }
        };
        const result = DashboardTaskService.getNextFrequencyDate(basisDate, frequency);
        expect(result).toEqual(new Date(2024, 0, 3));
      });

      it('should return a valid date for every X Week', () => {
        const basisDate = new Date(2024, 0, 1);
        const frequency: RecurrenceFrequency = {
          type: RecurrenceFrequencyType.everyXTimeUnit,
          everyXTimeUnit: {
            timeUnit: 'week',
            x: 2
          }
        };
        const result = DashboardTaskService.getNextFrequencyDate(basisDate, frequency);
        expect(result).toEqual(new Date(2024, 0, 15));
      });

      it('should return a valid date for every X Month', () => {
        const basisDate = new Date(2024, 0, 1);
        const frequency: RecurrenceFrequency = {
          type: RecurrenceFrequencyType.everyXTimeUnit,
          everyXTimeUnit: {
            timeUnit: 'month',
            x: 2
          }
        };
        const result = DashboardTaskService.getNextFrequencyDate(basisDate, frequency);
        expect(result).toEqual(new Date(2024, 2, 1));
      });
    });

    it('should return a valid date for weekDaySet', () => {
      const basisDate = new Date(2024, 0, 1);
      const frequency: RecurrenceFrequency = {
        type: RecurrenceFrequencyType.weekDaySet,
        weekDaySet: [0, 6]
      };
      const result = DashboardTaskService.getNextFrequencyDate(basisDate, frequency);
      expect(result).toEqual(new Date(2024, 0, 6));
    });

    describe('Every X Weekday of Month', () => {
      it('should return a valid date for every 2nd Sunday of Month', () => {
        const basisDate = new Date(2024, 0, 1);
        // Every second sunday
        const frequency: RecurrenceFrequency = {
          type: RecurrenceFrequencyType.everyXWeekdayOfMonth,
          everyXWeekdayOfMonth: {
            weekDay: 0,
            weekOfMonth: 2
          }
        };
        const result = DashboardTaskService.getNextFrequencyDate(basisDate, frequency);
        expect(result).toEqual(new Date(2024, 0, 14));
      });

      it('should return a valid date across year change', () => {
        const basisDate = new Date(2023, 11, 30);
        // Every 1st Saturday
        const frequency: RecurrenceFrequency = {
          type: RecurrenceFrequencyType.everyXWeekdayOfMonth,
          everyXWeekdayOfMonth: {
            weekDay: 6,
            weekOfMonth: 1
          }
        };
        const result = DashboardTaskService.getNextFrequencyDate(basisDate, frequency);
        expect(result).toEqual(new Date(2024, 0, 6));
      });

      it('should return a valid next date when the basis is the same as the recurrence', () => {
        const basisDate = new Date(2024, 0, 14);
        // Every second sunday
        const frequency: RecurrenceFrequency = {
          type: RecurrenceFrequencyType.everyXWeekdayOfMonth,
          everyXWeekdayOfMonth: {
            weekDay: 0,
            weekOfMonth: 2
          }
        };
        const result = DashboardTaskService.getNextFrequencyDate(basisDate, frequency);
        expect(result).toEqual(new Date(2024, 1, 11));
      });
    });
  });

  describe('updateDatesForRecurrence', () => {
    describe('Start date basis', () => {
      it('should update the start date and due date for a daily recurrence', () => {
        const task = DashboardTaskSchema.parse({ userId: DocumentService.generateID() });
        task.startDate = new Date(2024, 0, 1);
        task.recurrenceInfo = {
          frequency: {
            type: RecurrenceFrequencyType.everyXTimeUnit,
            everyXTimeUnit: {
              timeUnit: 'day',
              x: 1
            }
          },
          recurrenceBasis: RecurrenceBasis.startDate,
          recurrenceEffect: RecurrenceEffect.rollOnBasis
        };
        DashboardTaskService.updateDatesForRecurrence(task);
        expect(task.startDate).toEqual(new Date(2024, 0, 2));
      });

      it('should update the start date correctly for daily recurrence on subtask', () => {
        const task = DashboardTaskSchema.parse({ userId: DocumentService.generateID() });
        task.startDate = new Date(2024, 0, 8);
        task.dueDate = new Date(2024, 0, 13);
        task.recurrenceInfo = {
          frequency: {
            type: RecurrenceFrequencyType.everyXTimeUnit,
            everyXTimeUnit: {
              timeUnit: 'day',
              x: 1
            }
          },
          recurrenceBasis: RecurrenceBasis.startDate,
          recurrenceEffect: RecurrenceEffect.rollOnBasis
        };
        task.parentRecurringTaskInfo = {
          taskId: DocumentService.generateID(),
          startDate: new Date(2024, 0, 1)
        };
        DashboardTaskService.updateDatesForRecurrence(task);
        expect(task.startDate).toEqual(new Date(2024, 0, 9));
        expect(task.dueDate).toEqual(new Date(2024, 0, 14));
      });

      it('should update the start date correctly for a weekly recurrence', () => {
        const task = DashboardTaskSchema.parse({ userId: DocumentService.generateID() });
        task.startDate = new Date(2024, 0, 1);
        task.recurrenceInfo = {
          frequency: {
            type: RecurrenceFrequencyType.everyXTimeUnit,
            everyXTimeUnit: {
              timeUnit: 'week',
              x: 1
            }
          },
          recurrenceBasis: RecurrenceBasis.startDate,
          recurrenceEffect: RecurrenceEffect.rollOnBasis
        };
        DashboardTaskService.updateDatesForRecurrence(task);
        expect(task.startDate).toEqual(new Date(2024, 0, 8));
      });

      it('should update the start and due date correctly for a weekDaySet reccurence', () => {
        const task = DashboardTaskSchema.parse({ userId: DocumentService.generateID() });
        task.startDate = new Date(2024, 0, 1, 11);
        task.dueDate = new Date(2024, 0, 4, 23, 59);
        task.recurrenceInfo = {
          frequency: {
            type: RecurrenceFrequencyType.weekDaySet,
            weekDaySet: [0, 5]
          },
          recurrenceBasis: RecurrenceBasis.startDate,
          recurrenceEffect: RecurrenceEffect.rollOnBasis
        };
        DashboardTaskService.updateDatesForRecurrence(task);
        expect(task.startDate).toEqual(new Date(2024, 0, 5, 11));
        expect(task.dueDate).toEqual(new Date(2024, 0, 8, 23, 59));
      });

      it('should update the start and due date correctly for a everyXWeekdayOfMonth reccurence', () => {
        const task = DashboardTaskSchema.parse({ userId: DocumentService.generateID() });
        task.startDate = new Date(2024, 0, 1, 11);
        task.dueDate = new Date(2024, 0, 4, 23, 59);
        task.recurrenceInfo = {
          frequency: {
            type: RecurrenceFrequencyType.everyXWeekdayOfMonth,
            everyXWeekdayOfMonth: {
              weekDay: 0,
              weekOfMonth: 1
            }
          },
          recurrenceBasis: RecurrenceBasis.startDate,
          recurrenceEffect: RecurrenceEffect.rollOnBasis
        };
        DashboardTaskService.updateDatesForRecurrence(task);
        expect(task.startDate).toEqual(new Date(2024, 0, 7, 11));
        expect(task.dueDate).toEqual(new Date(2024, 0, 10, 23, 59));
      });
    });
  });

  describe('getFilteredAndSortedTaskIds', () => {
    it('should return a list of tasks for a category', () => {
      // Setup
      const { tasksList, taskMap, filterSettings, sortSettings, tagSettings } =
        setupSortAndFilterTest();
      tasksList[0].category = 'somethingelse';

      // Call
      const { filteredAndSortedIds: result } = DashboardTaskService.getFilteredAndSortedTaskIds(
        taskMap,
        'default',
        filterSettings,
        sortSettings,
        tagSettings
      );

      // Assert
      expect(result.length).toBe(4);
      result.forEach((taskId) => {
        expect(taskMap[taskId].category).toBe('default');
      });
    });

    it('should return a sorted list of tasks by start date', () => {
      const { tasksList, taskMap, filterSettings, sortSettings, tagSettings } =
        setupSortAndFilterTest();
      sortSettings.sortList.push({
        sortBy: DashboardTaskSortBy.startDate,
        sortDirection: DashboardTaskSortDirection.descending
      });
      const startDate1 = new Date(2024, 0, 3);
      const startDate2 = new Date(2024, 0, 2);
      const startDate3 = new Date(2024, 0, 1);
      tasksList[4].startDate = startDate1;
      tasksList[1].startDate = startDate2;
      tasksList[2].startDate = startDate3;

      const { filteredAndSortedIds: result } = DashboardTaskService.getFilteredAndSortedTaskIds(
        taskMap,
        'default',
        filterSettings,
        sortSettings,
        tagSettings
      );

      expect(result.length).toBe(5);
      expect(taskMap[result[0]].startDate?.getTime()).toBe(startDate1.getTime());
      expect(taskMap[result[1]].startDate?.getTime()).toBe(startDate2.getTime());
      expect(taskMap[result[2]].startDate?.getTime()).toBe(startDate3.getTime());
    });

    it('should return a sorted list of tasks by tags, when settings are provided', () => {
      const { tasksList, taskMap, filterSettings, sortSettings, tagSettings } =
        setupSortAndFilterTest();
      sortSettings.sortList.push({
        sortBy: DashboardTaskSortBy.tags,
        sortDirection: DashboardTaskSortDirection.descending
      });
      tagSettings['tag1'] = {
        priority: 1
      };
      tagSettings['tag2'] = {
        priority: 2
      };
      tagSettings['tag3'] = {
        priority: 3
      };
      tasksList[4].tags = {
        [sortSettings.userId]: ['tag1', 'tag2']
      };
      tasksList[1].tags = {
        [sortSettings.userId]: ['tagWithoutPriority']
      };
      tasksList[2].tags = {
        [sortSettings.userId]: ['tag1', 'tag3']
      };
      tasksList[3].tags = {
        [sortSettings.userId]: ['tag1']
      };

      const { filteredAndSortedIds: result } = DashboardTaskService.getFilteredAndSortedTaskIds(
        taskMap,
        'default',
        filterSettings,
        sortSettings,
        tagSettings
      );

      expect(result.length).toBe(5);
      expect(taskMap[result[0]].tags[sortSettings.userId]).toEqual(['tag1', 'tag3']);
      expect(taskMap[result[1]].tags[sortSettings.userId]).toEqual(['tag1', 'tag2']);
      expect(taskMap[result[2]].tags[sortSettings.userId]).toEqual(['tag1']);
    });

    it('should return a correct tag header map when sorting tags descending', () => {
      const { tasksList, taskMap, filterSettings, sortSettings, tagSettings } =
        setupSortAndFilterTest(10);
      sortSettings.sortList.push({
        sortBy: DashboardTaskSortBy.tags,
        sortDirection: DashboardTaskSortDirection.descending
      });
      sortSettings.sortList.push({
        sortBy: DashboardTaskSortBy.title,
        sortDirection: DashboardTaskSortDirection.ascending
      });
      tagSettings['tag1'] = {
        priority: 1
      };
      tagSettings['tag2'] = {
        priority: 2
      };
      tagSettings['tag3'] = {
        priority: 3
      };
      const task1 = tasksList[4];
      const task2 = tasksList[0];
      const task3 = tasksList[1];
      const task4 = tasksList[2];
      const task5 = tasksList[3];
      const task6 = tasksList[5];
      task1.tags = {
        [sortSettings.userId]: ['tag1', 'tag3']
      };
      task1.title = 'a';
      task2.tags = {
        [sortSettings.userId]: ['tag3']
      };
      task2.title = 'b';
      task3.tags = {
        [sortSettings.userId]: ['tag2', 'tag1']
      };
      task4.tags = {
        [sortSettings.userId]: ['tag1']
      };
      task5.tags = {
        [sortSettings.userId]: ['tagWithoutPriority']
      };
      task6.tags = {
        [sortSettings.userId]: ['tagWithoutPriority']
      };

      const { filteredAndSortedIds: sortedTaskIds } =
        DashboardTaskService.getFilteredAndSortedTaskIds(
          taskMap,
          'default',
          filterSettings,
          sortSettings,
          tagSettings
        );

      expect(sortedTaskIds.length).toBe(10);
      expect(sortedTaskIds[0]).toBe(task1._id);
      expect(sortedTaskIds[1]).toBe(task2._id);
      expect(sortedTaskIds[2]).toBe(task3._id);
      expect(sortedTaskIds[3]).toBe(task4._id);
      expect(sortedTaskIds[4]).toBe(task5._id);

      const result = DashboardTaskService.getTagHeaderMap(
        taskMap,
        sortedTaskIds,
        sortSettings.userId,
        tagSettings,
        'No Priority',
        DashboardTaskSortDirection.descending
      );

      expect(Object.keys(result).length).toBe(4);
      expect(result[task1._id]).toBe('tag3');
      expect(result[task3._id]).toBe('tag2');
      expect(result[task4._id]).toBe('tag1');
      expect(result[task5._id]).toBe('No Priority');
    });

    it('should return a correct tag header map when sorting tags ascending', () => {
      const { tasksList, taskMap, filterSettings, sortSettings, tagSettings } =
        setupSortAndFilterTest();
      sortSettings.sortList.push({
        sortBy: DashboardTaskSortBy.tags,
        sortDirection: DashboardTaskSortDirection.ascending
      });
      tagSettings['tag1'] = {
        priority: 1
      };
      tagSettings['tag2'] = {
        priority: 2
      };
      tagSettings['tag3'] = {
        priority: 3
      };
      tagSettings['tag4'] = {
        priority: 4
      };
      const task1 = tasksList[4];
      const task2 = tasksList[0];
      const task3 = tasksList[1];
      const task4 = tasksList[2];
      const task5 = tasksList[3];
      task1.tags = {
        [sortSettings.userId]: ['tagWithoutPriority', 'tag3']
      };
      task2.tags = {
        [sortSettings.userId]: ['tag3', 'tag4', 'tag1']
      };
      task3.tags = {
        [sortSettings.userId]: ['tag2']
      };
      task4.tags = {
        [sortSettings.userId]: ['tag3', 'tag4']
      };
      task5.tags = {
        [sortSettings.userId]: ['tag4']
      };

      const { filteredAndSortedIds: sortedTaskIds } =
        DashboardTaskService.getFilteredAndSortedTaskIds(
          taskMap,
          'default',
          filterSettings,
          sortSettings,
          tagSettings
        );

      expect(sortedTaskIds.length).toBe(5);
      expect(sortedTaskIds[0]).toBe(task1._id);
      expect(sortedTaskIds[1]).toBe(task2._id);
      expect(sortedTaskIds[2]).toBe(task3._id);
      expect(sortedTaskIds[3]).toBe(task4._id);
      expect(sortedTaskIds[4]).toBe(task5._id);

      const result = DashboardTaskService.getTagHeaderMap(
        taskMap,
        sortedTaskIds,
        sortSettings.userId,
        tagSettings,
        'No Priority',
        DashboardTaskSortDirection.ascending
      );

      expect(Object.keys(result).length).toBe(5);
      expect(result[task1._id]).toBe('No Priority');
      expect(result[task2._id]).toBe('tag1');
      expect(result[task3._id]).toBe('tag2');
      expect(result[task4._id]).toBe('tag3');
      expect(result[task5._id]).toBe('tag4');
    });

    it('should return a sorted list of tasks by tags, start date, and title', () => {
      const { tasksList, taskMap, filterSettings, sortSettings, tagSettings } =
        setupSortAndFilterTest(10);
      sortSettings.sortList.push(
        {
          sortBy: DashboardTaskSortBy.tags,
          sortDirection: DashboardTaskSortDirection.descending
        },
        {
          sortBy: DashboardTaskSortBy.startDate,
          sortDirection: DashboardTaskSortDirection.ascending
        },
        {
          sortBy: DashboardTaskSortBy.title,
          sortDirection: DashboardTaskSortDirection.ascending
        }
      );
      tagSettings['tag1'] = {
        priority: 1
      };
      tagSettings['tag2'] = {
        priority: 2
      };

      // Each task below should end up being sorted in that order.
      const task1 = tasksList[4];
      const task2 = tasksList[7];
      const task3 = tasksList[1];
      const task4 = tasksList[2];
      const task5 = tasksList[3];
      const task6 = tasksList[5];

      task1.tags = {
        [sortSettings.userId]: ['tag1', 'tag2']
      };
      task2.tags = {
        [sortSettings.userId]: ['tag1', 'tag2']
      };
      task3.tags = {
        [sortSettings.userId]: ['tag1']
      };
      task4.tags = {
        [sortSettings.userId]: ['tag1']
      };
      task5.tags = {
        [sortSettings.userId]: ['tag1']
      };
      task6.tags = {
        [sortSettings.userId]: ['tag1']
      };
      task1.startDate = new Date(2024, 0, 1);
      task2.startDate = new Date(2024, 0, 2);
      task3.startDate = new Date(2023, 0, 1);
      task4.startDate = new Date(2023, 0, 2);
      task5.startDate = new Date(2023, 0, 2);
      task6.startDate = new Date(2023, 0, 2);
      // The title shouldn't matter for the first two tasks, because the start
      // date should take precedence.
      task1.title = 'b';
      task2.title = 'a';
      task3.title = 'c';
      // Title only matters for the last 3 tasks
      task4.title = 'a';
      task5.title = 'b';
      task6.title = 'c';

      const { filteredAndSortedIds: result } = DashboardTaskService.getFilteredAndSortedTaskIds(
        taskMap,
        'default',
        filterSettings,
        sortSettings,
        tagSettings
      );

      expect(result.length).toBe(10);
      expect(result[0]).toBe(task1._id);
      expect(result[1]).toBe(task2._id);
      expect(result[2]).toBe(task3._id);
      expect(result[3]).toBe(task4._id);
      expect(result[4]).toBe(task5._id);
      expect(result[5]).toBe(task6._id);
    });
  });
});

/**
 * Sets up the test environment for sorting and filtering tasks.
 *
 * @param numTasks - The number of tasks to create for the test.
 * @returns An object containing tasksList, taskMap, taskIds, filterSettings, sortSettings, and tagSettings.
 */
function setupSortAndFilterTest(numTasks = 5) {
  const userId = DocumentService.generateID();
  const tasksList = createTasksList(numTasks, userId);
  const taskMap = createTaskMapFromList(tasksList);
  const filterSettings = getFilterSettings(userId);
  const sortSettings = getSortSettings(userId);
  const tagSettings = {} as DashboardTagSettings;
  const taskIds = Object.keys(taskMap);
  return {
    tasksList,
    taskMap,
    taskIds,
    filterSettings,
    sortSettings,
    tagSettings
  };
}

/**
 * Creates a list of tasks for the given user.
 *
 * @param numTasks - The number of tasks to create.
 * @param userId - The ID of the user for whom the tasks are created.
 * @returns An array of DashboardTask objects.
 */
function createTasksList(numTasks: number, userId: UUID): DashboardTask[] {
  const tasks: DashboardTask[] = [];
  for (let i = 0; i < numTasks; i += 1) {
    const task = DashboardTaskSchema.parse({ userId });
    tasks.push(task);
  }
  return tasks;
}

/**
 * Creates a map of tasks from a list of tasks.
 *
 * @param tasks - The list of tasks to convert into a map.
 * @returns A map where the keys are task IDs and the values are DashboardTask objects.
 */
function createTaskMapFromList(tasks: DashboardTask[]) {
  return tasks.reduce<Record<string, DashboardTask>>((acc, task) => {
    acc[task._id] = task;
    return acc;
  }, {});
}

/**
 * Gets the filter settings for the given user.
 *
 * @param userId - The ID of the user for whom the filter settings are retrieved.
 * @returns The filter settings for the user.
 */
function getFilterSettings(userId: UUID): DashboardTaskListFilterSettings {
  return {
    userId: userId,
    completed: {
      show: true
    },
    grandChildrenTasks: {
      show: false
    },
    startDate: {
      showFutureTasks: true
    },
    tags: {}
  };
}

/**
 * Gets the sort settings for the given user.
 *
 * @param userId - The ID of the user for whom the sort settings are retrieved.
 * @returns The sort settings for the user.
 */
function getSortSettings(userId: UUID): DashboardTaskListSortSettings {
  return {
    userId: userId,
    sortList: []
  };
}
