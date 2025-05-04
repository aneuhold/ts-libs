import { ObjectId } from 'bson';
import DashboardTask from '../../../documents/dashboard/Task.js';

/**
 * Validates the recurrence information of a given task.
 *
 * @param task - The dashboard task to validate.
 * @param errors - An array to collect validation error messages.
 */
export function validateRecurrenceInfo(
  task: DashboardTask,
  errors: string[]
): void {
  const recurrenceErrors: string[] = [];
  if (!task.recurrenceInfo) {
    return;
  }

  if (!task.recurrenceInfo.frequency) {
    recurrenceErrors.push('RecurrenceInfo frequency is required.');
  }
  if (!task.recurrenceInfo.recurrenceBasis) {
    recurrenceErrors.push('RecurrenceInfo recurrenceBasis is required.');
  }
  if (!task.recurrenceInfo.recurrenceEffect) {
    recurrenceErrors.push('RecurrenceInfo recurrenceEffect is required.');
  }

  // Write more of this later if there are any changes to the data model so it
  // can be correctly converted.

  if (recurrenceErrors.length > 0) {
    task.recurrenceInfo = undefined;
  }
  errors.push(...recurrenceErrors);
}

/**
 * Represents the recurrence information for a task.
 */
export type RecurrenceInfo = {
  frequency: RecurrenceFrequency;
  recurrenceBasis: RecurrenceBasis;
  recurrenceEffect: RecurrenceEffect;
};

/**
 * Represents the frequency of recurrence for a task.
 */
export type RecurrenceFrequency = {
  type: RecurrenceFrequencyType;
  everyXTimeUnit?: {
    timeUnit: 'day' | 'week' | 'month' | 'year';
    /**
     * The number of time units that should pass before the task recurs.
     */
    x: number;
  };
  /**
   * The set of week days that the task should recur on. This is 0-6 with 0
   * being Sunday.
   *
   * The idea that each of these values is unique needs to be enforced on the
   * frontend.
   */
  weekDaySet?: number[];
  everyXWeekdayOfMonth?: {
    weekDay: number;
    /**
     * The week of the month that the task should recur on. This is 0-4 with 0
     * being the first week of the month. If this is 'last', then it will
     * recur on the last week of the month.
     */
    weekOfMonth: number | 'last';
  };
};

/**
 * Enum representing the different types of recurrence frequencies.
 */
export enum RecurrenceFrequencyType {
  everyXTimeUnit = 'everyXTimeUnit',
  weekDaySet = 'weekDaySet',
  everyXWeekdayOfMonth = 'everyXWeekdayOfMonth',
  lastDayOfMonth = 'lastDayOfMonth'
}

/**
 * The basis of date movement for a recurring task.
 */
export enum RecurrenceBasis {
  startDate = 'startDate',
  dueDate = 'dueDate'
}

/**
 * The effect of recurrence for a recurring task.
 */
export enum RecurrenceEffect {
  /**
   * Automatically refreshes the task when the {@link RecurrenceBasis} triggers.
   */
  rollOnBasis = 'rollOnBasis',
  /**
   * Moves the task forward from the completed date and doesn't reset the task
   * when the {@link RecurrenceBasis} triggers.
   */
  rollOnCompletion = 'rollOnCompletion',
  /**
   * When the {@link RecurrenceBasis} triggers, and the current task isn't
   * completed, makes a duplicate task and clears {@link RecurrenceInfo} on
   * the original task.
   */
  stack = 'stack'
}

/**
 * The recurring task info for the parent recurring task if there is one.
 *
 * If this is set, then the current tasks's recurrence info should be the
 * same as the parent recurring task.
 */
export type ParentRecurringTaskInfo = {
  taskId: ObjectId;
  startDate?: Date;
  dueDate?: Date;
};
