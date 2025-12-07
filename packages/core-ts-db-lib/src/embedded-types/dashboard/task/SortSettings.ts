import type { UUID } from 'crypto';
import { z } from 'zod';

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

/**
 * Zod schema for {@link DashboardTaskSortBy}.
 */
export const DashboardTaskSortBySchema = z.enum(DashboardTaskSortBy);

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

/**
 * Zod schema for {@link DashboardTaskSortDirection}.
 */
export const DashboardTaskSortDirectionSchema = z.enum(DashboardTaskSortDirection);

/**
 * Zod schema for {@link DashboardTaskSortSetting}.
 */
export const DashboardTaskSortSettingSchema = z.object({
  sortBy: DashboardTaskSortBySchema,
  sortDirection: DashboardTaskSortDirectionSchema
});

/**
 * Represents a sort setting for a task list.
 */
export type DashboardTaskSortSetting = z.infer<typeof DashboardTaskSortSettingSchema>;

/**
 * Zod schema for {@link DashboardTaskListSortSettings}.
 */
export const DashboardTaskListSortSettingsSchema = z.object({
  /**
   * The ID of the user.
   */
  userId: z.uuidv7().transform((val) => val as UUID),
  sortList: z.array(DashboardTaskSortSettingSchema)
});

/**
 * The sort settings for a list of tasks for a particular user.
 */
export type DashboardTaskListSortSettings = z.infer<typeof DashboardTaskListSortSettingsSchema>;

/**
 * Zod schema for {@link DashboardTaskSortSettings}.
 */
export const DashboardTaskSortSettingsSchema = z.record(
  z.uuidv7().transform((val) => val as UUID),
  DashboardTaskListSortSettingsSchema
);

/**
 * The sort settings for a particular task. Each user can have their
 * own settings for a task.
 */
export type DashboardTaskSortSettings = z.infer<typeof DashboardTaskSortSettingsSchema>;

/**
 * Zod schema for {@link DashboardTaskListGlobalSortSettings}.
 */
export const DashboardTaskListGlobalSortSettingsSchema = z.record(
  z.string(),
  DashboardTaskListSortSettingsSchema
);

/**
 * Represents the global sort settings for the task list.
 */
export type DashboardTaskListGlobalSortSettings = z.infer<
  typeof DashboardTaskListGlobalSortSettingsSchema
>;
