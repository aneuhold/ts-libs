import DashboardUserConfig from '../../../documents/dashboard/UserConfig.js';
import Validate from '../../../schemas/validators/ValidateUtil.js';

/**
 * Returns the default filter settings for a task list for a given user.
 *
 * @param userId - The ID of the user.
 * @returns The default filter settings for the user's task list.
 */
export function getDefaultTaskListFilterSettings(userId: string): DashboardTaskListFilterSettings {
  return {
    userId,
    completed: { show: true },
    grandChildrenTasks: { show: false },
    startDate: { showFutureTasks: true },
    tags: {}
  };
}

/**
 * Validates the filter settings in the user configuration.
 *
 * @param validate - The validation utility.
 * @param config - The user configuration containing the filter settings.
 */
export function validateFilterSettings(validate: Validate, config: DashboardUserConfig) {
  validate.object('taskListFilterSettings', {});
  const categories = Object.keys(config.taskListFilterSettings);
  if (categories.length > 0) {
    const defaultSettings = getDefaultTaskListFilterSettings(config.userId);
    categories.forEach((category) => {
      validate.string(`taskListFilterSettings.${category}.userId`, defaultSettings.userId);
      validate.object(`taskListFilterSettings.${category}.completed`, defaultSettings.completed);
      validate.boolean(
        `taskListFilterSettings.${category}.completed.show`,
        defaultSettings.completed.show
      );
      validate.object(
        `taskListFilterSettings.${category}.grandChildrenTasks`,
        defaultSettings.grandChildrenTasks
      );
      validate.boolean(
        `taskListFilterSettings.${category}.grandChildrenTasks.show`,
        defaultSettings.grandChildrenTasks.show
      );
      validate.object(`taskListFilterSettings.${category}.startDate`, defaultSettings.startDate);
      validate.boolean(
        `taskListFilterSettings.${category}.startDate.showFutureTasks`,
        defaultSettings.startDate.showFutureTasks
      );
      validate.object(`taskListFilterSettings.${category}.tags`, defaultSettings.tags);
    });
  }
}

/**
 * Global task list filter settings. These are created for each user in the
 * Dashboard config.
 */
export type DashboardTaskListGlobalFilterSettings = {
  [category: string]: DashboardTaskListFilterSettings;
};

/**
 * The filter settings for a particular task. Each user can have their
 * own settings for a task.
 */
export type DashboardTaskFilterSettings = {
  [userId: string]: DashboardTaskListFilterSettings;
};

/**
 * The filter settings for a list of tasks for a particular user.
 *
 * Any new settings should be made optional so that they can be added
 * without breaking existing users or tasks.
 */
export type DashboardTaskListFilterSettings = {
  userId: string;
  completed: StandardFilterSetting;
  grandChildrenTasks: StandardFilterSetting;
  startDate: {
    showFutureTasks: boolean;
  };
  /**
   * The default for tags, if not defined, is to show them.
   */
  tags: { [tag: string]: StandardFilterSetting };
};

export type StandardFilterSetting = {
  show: boolean;
};
