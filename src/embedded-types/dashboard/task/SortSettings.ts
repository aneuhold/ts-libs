import DashboardUserConfig from '../../../documents/dashboard/UserConfig.js';
import Validate from '../../../schemas/validators/ValidateUtil.js';

export function getDefaultTaskListSortSettings(
  userId: string
): DashboardTaskListSortSettings {
  return {
    userId,
    sortList: []
  };
}

export function validateSortSettings(
  validate: Validate,
  config: DashboardUserConfig
) {
  validate.object('taskListSortSettings', {});
  const categories = Object.keys(config.taskListSortSettings);
  if (categories.length > 0) {
    const defaultSettings = getDefaultTaskListSortSettings(
      config.userId.toString()
    );
    categories.forEach((category) => {
      validate.string(
        `taskListSortSettings.${category}.userId`,
        defaultSettings.userId
      );
      validate.array(
        `taskListSortSettings.${category}.sortList`,
        defaultSettings.sortList
      );
    });
  }
}

export type DashboardTaskListGlobalSortSettings = {
  [category: string]: DashboardTaskListSortSettings;
};

/**
 * The sort settings for a particular task. Each user can have their
 * own settings for a task.
 */
export type DashboardTaskSortSettings = {
  [userId: string]: DashboardTaskListSortSettings;
};

/**
 * The sort settings for a list of tasks for a particular user.
 */
export type DashboardTaskListSortSettings = {
  userId: string;
  sortList: Array<DashboardTaskSortSetting>;
};

/**
 * The sortBy options for a task list.
 */
export enum DashboardTaskSortBy {
  /**
   * Tags are special because they depend on the user's global tag settings.
   */
  tags = 'tags',
  title = 'title',
  dueDate = 'dueDate',
  startDate = 'startDate',
  createdDate = 'createdDate',
  lastUpdatedDate = 'lastUpdatedDate'
}

export type DashboardTaskSortSetting = {
  sortBy: DashboardTaskSortBy;
  sortDirection: DashboardTaskSortDirection;
};

/**
 * The sort direction for a sorting setting. This is used as a multiplier
 * for the sort function.
 */
export enum DashboardTaskSortDirection {
  /**
   * Higher as the numbers go down the list.
   */
  ascending = 1,
  /**
   * Lower as the numbers go down the list.
   */
  descending = -1
}
