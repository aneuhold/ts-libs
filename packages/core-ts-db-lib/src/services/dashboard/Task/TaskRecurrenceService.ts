import { DateService } from '@aneuhold/core-ts-lib';
import DashboardTask from '../../../documents/dashboard/Task.js';
import {
  RecurrenceBasis,
  RecurrenceFrequency,
  RecurrenceFrequencyType
} from '../../../embedded-types/dashboard/task/RecurrenceInfo.js';

export default class DashboardTaskRecurrenceService {
  /**
   * Gets the next frequency date from the provided basis date.
   *
   * @param basisDate - The date from which to calculate the next frequency date.
   * @param frequency - The recurrence frequency details.
   * @returns The next frequency date or null if the frequency is in an invalid state.
   */
  static getNextFrequencyDate(
    basisDate: Date,
    frequency: RecurrenceFrequency
  ): Date | null {
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
   *
   * @param task - The task whose dates need to be updated.
   */
  static updateDatesForRecurrence(task: DashboardTask): void {
    // Initial basic validation
    if (!task.recurrenceInfo) {
      return;
    }
    // Validation for dates based on parent
    if (task.parentRecurringTaskInfo) {
      if (
        // No dates to move forward
        (!task.dueDate && !task.startDate) ||
        // Invalid start date recurrence basis
        (task.recurrenceInfo.recurrenceBasis === RecurrenceBasis.startDate &&
          !task.parentRecurringTaskInfo.startDate) ||
        // Invalid due date recurrence basis
        (task.recurrenceInfo.recurrenceBasis === RecurrenceBasis.dueDate &&
          !task.parentRecurringTaskInfo.dueDate)
      ) {
        return;
      }
      // Validation for moving dates based on their own recurrence
    } else if (
      !task.recurrenceInfo ||
      (task.recurrenceInfo.recurrenceBasis === RecurrenceBasis.startDate &&
        !task.startDate) ||
      (task.recurrenceInfo.recurrenceBasis === RecurrenceBasis.dueDate &&
        !task.dueDate)
    ) {
      return;
    }

    let diff = 0;

    if (task.parentRecurringTaskInfo) {
      if (task.recurrenceInfo.recurrenceBasis === RecurrenceBasis.startDate) {
        diff = this.getDiffForDateUpdate(
          task.parentRecurringTaskInfo.startDate,
          task.recurrenceInfo.frequency
        );
      } else {
        diff = this.getDiffForDateUpdate(
          task.parentRecurringTaskInfo.dueDate,
          task.recurrenceInfo.frequency
        );
      }
    } else if (
      task.recurrenceInfo.recurrenceBasis === RecurrenceBasis.startDate
    ) {
      diff = this.getDiffForDateUpdate(
        task.startDate,
        task.recurrenceInfo.frequency
      );
    } else {
      diff = this.getDiffForDateUpdate(
        task.dueDate,
        task.recurrenceInfo.frequency
      );
    }

    if (task.startDate) {
      task.startDate = new Date(task.startDate.getTime() + diff);
    }
    if (task.dueDate) {
      task.dueDate = new Date(task.dueDate.getTime() + diff);
    }
  }

  /**
   * Calculates the difference in time between the basis date and the next frequency date.
   *
   * @param basisDate - The date from which to calculate the difference.
   * @param frequency - The recurrence frequency details.
   * @returns The difference in time in milliseconds.
   */
  private static getDiffForDateUpdate(
    basisDate: Date | undefined,
    frequency: RecurrenceFrequency
  ) {
    if (!basisDate) {
      return 0;
    }
    const nextFrequencyDate = this.getNextFrequencyDate(basisDate, frequency);
    if (!nextFrequencyDate) {
      return 0;
    }
    return nextFrequencyDate.getTime() - basisDate.getTime();
  }
}
