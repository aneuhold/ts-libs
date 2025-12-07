import type { UUID } from 'crypto';
import { z } from 'zod';

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
 * Zod schema for {@link RecurrenceFrequencyType}.
 */
export const RecurrenceFrequencyTypeSchema = z.enum(RecurrenceFrequencyType);

/**
 * The basis of date movement for a recurring task.
 */
export enum RecurrenceBasis {
  startDate = 'startDate',
  dueDate = 'dueDate'
}

/**
 * Zod schema for {@link RecurrenceBasis}.
 */
export const RecurrenceBasisSchema = z.enum(RecurrenceBasis);

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
 * Zod schema for {@link RecurrenceEffect}.
 */
export const RecurrenceEffectSchema = z.enum(RecurrenceEffect);

/**
 * Zod schema for {@link RecurrenceFrequency}.
 */
export const RecurrenceFrequencySchema = z.object({
  type: RecurrenceFrequencyTypeSchema,
  everyXTimeUnit: z
    .object({
      timeUnit: z.enum(['day', 'week', 'month', 'year']),
      /**
       * The number of time units that should pass before the task recurs.
       */
      x: z.int()
    })
    .optional(),
  /**
   * The set of week days that the task should recur on. This is 0-6 with 0
   * being Sunday.
   *
   * The idea that each of these values is unique needs to be enforced on the
   * frontend.
   */
  weekDaySet: z.array(z.int().min(0).max(6)).optional(),
  everyXWeekdayOfMonth: z
    .object({
      weekDay: z.int().min(0).max(6),
      /**
       * The week of the month that the task should recur on. This is 0-4 with 0
       * being the first week of the month. If this is 'last', then it will
       * recur on the last week of the month.
       */
      weekOfMonth: z.union([z.int().min(0).max(4), z.literal('last')])
    })
    .optional()
});

/**
 * Represents the frequency of recurrence for a task.
 */
export type RecurrenceFrequency = z.infer<typeof RecurrenceFrequencySchema>;

/**
 * Zod schema for {@link RecurrenceInfo}.
 */
export const RecurrenceInfoSchema = z.object({
  frequency: RecurrenceFrequencySchema,
  recurrenceBasis: RecurrenceBasisSchema,
  recurrenceEffect: RecurrenceEffectSchema
});

/**
 * Represents the recurrence information for a task.
 */
export type RecurrenceInfo = z.infer<typeof RecurrenceInfoSchema>;

/**
 * Zod schema for {@link ParentRecurringTaskInfo}.
 */
export const ParentRecurringTaskInfoSchema = z.object({
  /**
   * The ID of the parent recurring task.
   */
  taskId: z.uuidv7().transform((val) => val as UUID),
  startDate: z.date().optional(),
  dueDate: z.date().optional()
});

/**
 * The recurring task info for the parent recurring task if there is one.
 *
 * If this is set, then the current tasks's recurrence info should be the
 * same as the parent recurring task.
 */
export type ParentRecurringTaskInfo = z.infer<typeof ParentRecurringTaskInfoSchema>;
