import type { UUID } from 'crypto';
import { z } from 'zod';

/**
 * Zod schema for {@link StandardFilterSetting}.
 */
export const StandardFilterSettingSchema = z.object({
  show: z.boolean()
});

/**
 * Represents a standard filter setting.
 */
export type StandardFilterSetting = z.infer<typeof StandardFilterSettingSchema>;

/**
 * Zod schema for {@link DashboardTaskListFilterSettings}.
 */
export const DashboardTaskListFilterSettingsSchema = z.object({
  /**
   * The ID of the user.
   */
  userId: z.uuidv7().transform((val) => val as UUID),
  completed: StandardFilterSettingSchema.default({ show: true }),
  grandChildrenTasks: StandardFilterSettingSchema.default({ show: false }),
  startDate: z.object({
    showFutureTasks: z.boolean().default(true)
  }),
  /**
   * The default for tags, if not defined, is to show them.
   */
  tags: z.partialRecord(z.string(), StandardFilterSettingSchema).default({})
});

/**
 * The filter settings for a list of tasks for a particular user.
 *
 * Any new settings should be made optional so that they can be added
 * without breaking existing users or tasks.
 */
export type DashboardTaskListFilterSettings = z.infer<typeof DashboardTaskListFilterSettingsSchema>;

/**
 * Zod schema for {@link DashboardTaskFilterSettings}.
 */
export const DashboardTaskFilterSettingsSchema = z.partialRecord(
  z.uuidv7().transform((val) => val as UUID),
  DashboardTaskListFilterSettingsSchema
);

/**
 * The filter settings for a particular task. Each user can have their
 * own settings for a task.
 */
export type DashboardTaskFilterSettings = z.infer<typeof DashboardTaskFilterSettingsSchema>;

/**
 * Zod schema for {@link DashboardTaskListGlobalFilterSettings}.
 */
export const DashboardTaskListGlobalFilterSettingsSchema = z.partialRecord(
  /**
   * The category of the task list filter settings.
   */
  z.string(),
  DashboardTaskListFilterSettingsSchema
);

/**
 * Global task list filter settings. These are created for each user in the
 * Dashboard config. This is keyed on the category.
 */
export type DashboardTaskListGlobalFilterSettings = z.infer<
  typeof DashboardTaskListGlobalFilterSettingsSchema
>;
