import { ObjectId } from 'bson';
import BaseDocumentWithType from '../BaseDocumentWithType';
import RequiredUserId from '../../schemas/required-refs/RequiredUserId';
import Validate from '../../schemas/validators/ValidateUtil';
import { DocumentValidator } from '../../schemas/validators/DocumentValidator';
import {
  ParentRecurringTaskInfo,
  RecurrenceInfo,
  validateRecurrenceInfo
} from '../../embedded-types/dashboard/task/RecurrenceInfo';
import { DashboardTaskFilterSettings } from '../../embedded-types/dashboard/task/FilterSettings';
import { DashboardTaskSortSettings } from '../../embedded-types/dashboard/task/SortSettings';

export const validateDashboardTask: DocumentValidator<DashboardTask> = (
  task: DashboardTask
) => {
  const errors: string[] = [];
  const validate = new Validate(task, errors);
  const exampleTask = new DashboardTask(new ObjectId());

  validate.string('title', exampleTask.title);
  validate.boolean('completed', exampleTask.completed);
  validate.optionalString('description');
  validate.array('sharedWith', exampleTask.sharedWith);
  validate.optionalObject('recurrenceInfo');
  validate.object('tags', {});
  validate.string('category', exampleTask.category);
  validate.object('createdDate', exampleTask.createdDate);
  validate.object('lastUpdatedDate', exampleTask.lastUpdatedDate);
  validate.optionalObject('startDate');
  validate.optionalObject('dueDate');
  validate.optionalObject('parentRecurringTaskInfo');
  validate.object('filterSettings', {});
  validate.object('sortSettings', {});
  validateRecurrenceInfo(task, errors);

  return { updatedDoc: task, errors };
};

/**
 * A utility type for a map of tasks.
 */
export type DashboardTaskMap = { [taskId: string]: DashboardTask };

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
export default class DashboardTask
  extends BaseDocumentWithType
  implements RequiredUserId
{
  static docType = 'task';

  docType = DashboardTask.docType;

  /**
   * The owner of this task.
   */
  userId: ObjectId;

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
  sharedWith: ObjectId[] = [];

  /**
   * The recurrence info for this task if there is any.
   */
  recurrenceInfo?: RecurrenceInfo;

  /**
   * The recurring task info for the parent recurring task if there is one.
   *
   * If this is set, then the current tasks's recurrence info should be the
   * same as the parent recurring task.
   */
  parentRecurringTaskInfo?: ParentRecurringTaskInfo;

  title = '';

  completed = false;

  /**
   * The ID of the parent task if there is one.
   */
  parentTaskId?: ObjectId;

  /**
   * The description of the task. This is purposefully optional in case the
   * user wants to just use the title. This also helps the frontend
   * differentiate between a task that has no description and a task that has
   * an empty description.
   */
  description?: string;

  /**
   * The date this task was created.
   */
  createdDate = new Date();

  /**
   * The date this task was last updated.
   */
  lastUpdatedDate = new Date();

  startDate?: Date;

  dueDate?: Date;

  /**
   * User-assigned tags for this task.
   */
  tags: { [userId: string]: string[] } = {};

  /**
   * System-assigned category for this task. This should be used to determine
   * where this task should be displayed.
   */
  category: string = 'default';

  /**
   * The filter settings for subtasks of this task specifically, keyed on
   * each user.
   */
  filterSettings: DashboardTaskFilterSettings = {};

  /**
   * The sort settings for subtasks of this task specifically, keyed on
   * each user.
   */
  sortSettings: DashboardTaskSortSettings = {};

  constructor(ownerId: ObjectId) {
    super();
    this.userId = ownerId;
    this.tags = {
      [ownerId.toString()]: []
    };
  }
}
