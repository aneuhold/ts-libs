import type { UUID } from 'crypto';
import { z } from 'zod';
import { DashboardTaskListGlobalFilterSettingsSchema } from '../../embedded-types/dashboard/task/FilterSettings.js';
import { DashboardTaskListGlobalSortSettingsSchema } from '../../embedded-types/dashboard/task/SortSettings.js';
import { DashboardTagSettingsSchema } from '../../embedded-types/dashboard/userConfig/Tags.js';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import { BaseDocumentWithTypeSchema } from '../BaseDocument.js';

/**
 * The schema for {@link DashboardUserConfig} documents.
 */
export const DashboardUserConfigSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  docType: z.literal('userConfig').default('userConfig'),
  /**
   * The different users that the owner of this config is collaborating with
   * on the dashboard.
   */
  collaborators: z.array(z.uuidv7().transform((val) => val as UUID)).default([]),
  /**
   * Whether or not to enable dev mode for the user.
   */
  enableDevMode: z.boolean().default(false),
  /**
   * The features that are enabled for the user.
   */
  enabledFeatures: z
    .object({
      financePage: z.boolean().default(false),
      automationPage: z.boolean().default(false),
      entertainmentPage: z.boolean().default(false),
      homePageLinks: z.boolean().default(false),
      useConfettiForTasks: z.boolean().default(false),
      catImageOnHomePage: z.boolean().default(false)
    })
    .default({
      financePage: false,
      automationPage: false,
      entertainmentPage: false,
      homePageLinks: false,
      useConfettiForTasks: false,
      catImageOnHomePage: false
    }),
  /**
   * The number of days after which a task is automatically deleted. The
   * requirement is that this number is at least 5 days, and at most 90 days.
   *
   * Tasks are only deleted if:
   *
   * - They are not recurring
   * - They are not completed
   * - They have not been updated in the number listed by this setting
   */
  autoTaskDeletionDays: z.int().default(30),
  /**
   * The user's tag settings for the dashboard.
   */
  tagSettings: DashboardTagSettingsSchema.default({}),
  /**
   * The global sort settings for the user's task list.
   */
  taskListSortSettings: DashboardTaskListGlobalSortSettingsSchema.default({}),
  /**
   * The global filter settings for the user's task list.
   */
  taskListFilterSettings: DashboardTaskListGlobalFilterSettingsSchema.default({})
});

/**
 * Represents the user configuration for the dashboard.
 */
export type DashboardUserConfig = z.infer<typeof DashboardUserConfigSchema>;
