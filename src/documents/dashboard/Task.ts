import { ObjectId } from 'bson';
import BaseDocumentWithType from '../BaseDocumentWithType';
import RequiredUserId from '../../schemas/required-refs/RequiredUserId';
import Validate from '../../schemas/validators/ValidateUtil';
import { DocumentValidator } from '../../schemas/validators/DocumentValidator';

export const validateDashboardTask: DocumentValidator<DashboardTask> = (
  task: DashboardTask
) => {
  const errors: string[] = [];
  const validate = new Validate(task, errors);
  const exampleTask = new DashboardTask(new ObjectId());

  validate.string('title', exampleTask.title);
  validate.boolean('completed', exampleTask.completed);
  validate.optionalString('description');
  validate.array('tags', exampleTask.tags);
  validate.string('category', exampleTask.category);
  validate.object('createdDate', exampleTask.createdDate);
  validate.object('lastUpdatedDate', exampleTask.lastUpdatedDate);
  validate.optionalObject('startDate');
  validate.optionalObject('dueDate');

  return { updatedDoc: task, errors };
};

/**
 * Gets all the children task IDs for the given parent task IDs.
 */
export const getDashboardTaskChildrenIds = (
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
      const childrenTaskIds = getChildrenTaskIds(
        taskIdToTaskDict,
        parentToTaskIdsDict,
        taskId.toString()
      );
      childrenIds.push(...childrenTaskIds.map((id) => new ObjectId(id)));
    }
  });
  return childrenIds;
};

function getChildrenTaskIds(
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
      const grandchildrenIds = getChildrenTaskIds(
        taskIdToTaskDict,
        parentToTaskIdsDict,
        childId
      );
      childrenIds.push(...grandchildrenIds);
    }
  });
  return childrenIds;
}

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
   * The different users this task is shared with. This should be indexed
   * somehow.
   */
  sharedWith: ObjectId[] = [];

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
  tags: string[] = [];

  /**
   * System-assigned category for this task. This should be used to determine
   * where this task should be displayed.
   */
  category: string = 'default';

  constructor(ownerId: ObjectId) {
    super();
    this.userId = ownerId;
  }
}
