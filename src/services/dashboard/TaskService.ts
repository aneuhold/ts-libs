import { ObjectId } from 'bson';
import { DateService } from '@aneuhold/core-ts-lib';
import DashboardTask from '../../documents/dashboard/Task';
import {
  RecurrenceFrequency,
  RecurrenceFrequencyType
} from '../../embedded-types/dashboard/task/RecurrenceInfo';

export default class DashboardTaskService {
  /**
   * Gets all the children task IDs for the given parent task IDs.
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
   */
  static getNextFrequencyDate(basisDate: Date, frequency: RecurrenceFrequency) {
    // Last day of month
    if (frequency.type === RecurrenceFrequencyType.lastDayOfMonth) {
      return DateService.getLastDayOfGivenMonth(basisDate);
    }
    // Every X Time Unit
    if (frequency.type === RecurrenceFrequencyType.everyXTimeUnit) {
      if (!frequency.everyXTimeUnit) {
        return null;
      }
      if (frequency.everyXTimeUnit.timeUnit === 'day') {
        return DateService.addDays(basisDate, frequency.everyXTimeUnit.x);
      }
      if (frequency.everyXTimeUnit.timeUnit === 'week') {
        return DateService.addDays(basisDate, frequency.everyXTimeUnit.x * 7);
      }
      if (frequency.everyXTimeUnit.timeUnit === 'month') {
        return DateService.addMonths(basisDate, frequency.everyXTimeUnit.x);
      }
      if (frequency.everyXTimeUnit.timeUnit === 'year') {
        return DateService.addYears(basisDate, frequency.everyXTimeUnit.x);
      }
    }
    // Week Day Set
    if (frequency.type === RecurrenceFrequencyType.weekDaySet) {
      if (!frequency.weekDaySet) {
        return null;
      }
      const newDate = new Date(basisDate);
      let daysToAdd = 0;
      while (daysToAdd < 7) {
        newDate.setDate(newDate.getDate() + 1);
        if (frequency.weekDaySet.includes(newDate.getDay())) {
          return newDate;
        }
        daysToAdd += 1;
      }
    }
    // Every X Weekday of Month
    if (frequency.type === RecurrenceFrequencyType.everyXWeekdayOfMonth) {
      if (!frequency.everyXWeekdayOfMonth) {
        return null;
      }
      // Start by adding one day
      let newDate = DateService.getWeekDayOfXWeekOfMonth(
        DateService.addDays(basisDate, 1),
        frequency.everyXWeekdayOfMonth.weekDay,
        frequency.everyXWeekdayOfMonth.weekOfMonth
      );
      let monthsPassed = 0;
      while (
        !newDate ||
        newDate < basisDate ||
        newDate.getTime() === basisDate.getTime()
      ) {
        monthsPassed += 1;
        newDate = DateService.getWeekDayOfXWeekOfMonth(
          DateService.addMonths(basisDate, monthsPassed),
          frequency.everyXWeekdayOfMonth.weekDay,
          frequency.everyXWeekdayOfMonth.weekOfMonth
        );
        if (monthsPassed > 11) {
          return null;
        }
      }
      return newDate;
    }
    return null;
  }

  /**
   * Moves the start and due date forward by one frequency.
   *
   * This does not take into account the recurrence effect. That should be
   * handled on the frontend.
   *
   * Makes no changes if the state of the task is invalid for recurrence or
   * there isn't recurrence info.
   */
  static updateDatesForRecurrence(task: DashboardTask): void {
    // Initial basic validation
    if (
      !task.recurrenceInfo ||
      (task.recurrenceInfo.recurrenceBasis === 'startDate' &&
        !task.startDate) ||
      (task.recurrenceInfo.recurrenceBasis === 'dueDate' && !task.dueDate)
    ) {
      return;
    }

    // Start Date Basis
    if (task.recurrenceInfo.recurrenceBasis === 'startDate') {
      if (!task.startDate) {
        return;
      }
      const nextRecurDate = this.getNextFrequencyDate(
        task.startDate,
        task.recurrenceInfo.frequency
      );
      if (!nextRecurDate) {
        return;
      }
      const diff = nextRecurDate.getTime() - task.startDate.getTime();
      task.startDate = new Date(task.startDate.getTime() + diff);
      if (task.dueDate) {
        task.dueDate = new Date(task.dueDate.getTime() + diff);
      }
      return;
    }

    // Due Date Basis
    if (!task.dueDate) {
      return;
    }
    const nextRecurDate = this.getNextFrequencyDate(
      task.dueDate,
      task.recurrenceInfo.frequency
    );
    if (!nextRecurDate) {
      return;
    }
    const diff = nextRecurDate.getTime() - task.dueDate.getTime();
    task.dueDate = new Date(task.dueDate.getTime() + diff);
    if (task.startDate) {
      task.startDate = new Date(task.startDate.getTime() + diff);
    }
  }

  private static getChildrenTaskIds(
    taskIdToTaskDict: Record<string, DashboardTask>,
    parentToTaskIdsDict: Record<string, string[]>,
    taskId: string
  ) {
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
