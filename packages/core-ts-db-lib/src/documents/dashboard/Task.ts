import type { UUID } from 'crypto';
import { z } from 'zod';
import { DashboardTaskFilterSettingsSchema } from '../../embedded-types/dashboard/task/FilterSettings.js';
import {
  ParentRecurringTaskInfoSchema,
  RecurrenceInfoSchema
} from '../../embedded-types/dashboard/task/RecurrenceInfo.js';
import { DashboardTaskSortSettingsSchema } from '../../embedded-types/dashboard/task/SortSettings.js';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import type { DocumentMap } from '../../services/DocumentService.js';
import { BaseDocumentWithTypeSchema } from '../BaseDocument.js';

/**
 * The docType value for DashboardTask documents.
 */
export const DashboardTask_docType = 'task';

/**
 * The schema for {@link DashboardTask} documents.
 */
export const DashboardTaskSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  docType: z.literal(DashboardTask_docType).default(DashboardTask_docType),
  /**
   * What happens when:
   *
   * - A task is shared that has sub tasks? All the subtasks are shared as well from the frontend. This in case the frontend fails to make a connection to the backend, the state will still be correct.
   * - A subtask of a shared task is deleted? It is deleted like normal
   * - A user that has been shared a task adds a subtask? The subtask gets the same owner as the parent shared task.
   * - A shared task with subtasks is unshared? The frontend will need to make the updates and send them to the backend.
   * - A user removes a collaborator and they have shared tasks with that
   * collaborator? Nothing happens to the tasks. That way, if they add the
   * collaborator back it will return to normal. But the frontend needs to
   * double check for this when displaying things.
   */
  sharedWith: z.array(z.uuidv7().transform((val) => val as UUID)).default([]),
  /**
   * The user ID that this task is assigned to.
   */
  assignedTo: z
    .uuidv7()
    .transform((val) => val as UUID)
    .nullish(),
  /**
   * The recurrence info for this task if there is any.
   */
  recurrenceInfo: RecurrenceInfoSchema.nullish(),
  /**
   * The recurring task info for the parent recurring task if there is one.
   *
   * If this is set, then the current tasks's recurrence info should be the
   * same as the parent recurring task.
   */
  parentRecurringTaskInfo: ParentRecurringTaskInfoSchema.nullish(),
  /**
   * The title of the task.
   */
  title: z.string().default(''),
  completed: z.boolean().default(false),
  /**
   * The ID of the parent task if there is one.
   */
  parentTaskId: z
    .uuidv7()
    .transform((val) => val as UUID)
    .nullish(),
  /**
   * The description of the task. This is purposefully optional in case the
   * user wants to just use the title. This also helps the frontend
   * differentiate between a task that has no description and a task that has
   * an empty description.
   */
  description: z.string().nullish(),
  /**
   * The date this task was created.
   */
  createdDate: z.date().default(() => new Date()),
  /**
   * The date this task was last updated.
   */
  lastUpdatedDate: z.date().default(() => new Date()),
  startDate: z.date().nullish(),
  dueDate: z.date().nullish(),
  /**
   * User-assigned tags for this task.
   */
  tags: z
    .partialRecord(
      z.uuidv7().transform((id) => id as UUID),
      z.array(z.string())
    )
    .default({}),
  /**
   * System-assigned category for this task. This should be used to determine
   * where this task should be displayed.
   */
  category: z.string().default('default'),
  /**
   * The filter settings for subtasks of this task specifically, keyed on
   * each user.
   */
  filterSettings: DashboardTaskFilterSettingsSchema.default({}),
  /**
   * The sort settings for subtasks of this task specifically, keyed on
   * each user.
   */
  sortSettings: DashboardTaskSortSettingsSchema.default({})
});

/**
 * A utility type for a map of tasks.
 */
export type DashboardTaskMap = DocumentMap<DashboardTask>;

/**
 * When thinking about the logic of tasks, the following thoughts come to mind:
 *
 * What would you expect a task manager to do in the case that you have a task
 * with a bunch of subtasks, and you share that single task with another person?
 *
 * - Should the subtasks be automatically shared as well no matter what? (Would make behavior simpler for the user)
 * - Should there instead be an option to share the subtasks automatically?
 * - In the case that the other user adds a subtask to the original task you shared, would you expect to see that subtask?
 * - If there is an option to not share the subtasks automatically, what happens when the other user adds a subtask to the one you shared?
 *
 * Because of the complexity for the user in not automatically sharing subtasks,
 * it seems better to always automatically share subtasks. In a theoretical sense,
 * sharing a task with someone seems to imply the shared ownership of completing
 * the overall task, including all the subtasks.
 *
 * Recurring Tasks:
 *
 * - The user sets a task as recurring with a frequency? Only that task is marked, because when the recurrence comes up, the frontend will update that task and all sub tasks.
 * - The date + time for the recurrence happens? If the users browser is open, the frontend will trigger the update ideally. This needs to be checked if this can be done in a performant way.
 */
export type DashboardTask = z.infer<typeof DashboardTaskSchema>;
