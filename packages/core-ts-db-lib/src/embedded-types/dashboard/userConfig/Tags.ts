import { z } from 'zod';

/**
 * Zod schema for {@link DashboardTagSetting}.
 */
export const DashboardTagSettingSchema = z.object({
  /**
   * Higher priority value means higher priority.
   */
  priority: z.int(),
  color: z.string().nullish()
});

/**
 * Represents a setting for an individual tag.
 */
export type DashboardTagSetting = z.infer<typeof DashboardTagSettingSchema>;

/**
 * Zod schema for {@link DashboardTagSettings}.
 */
export const DashboardTagSettingsSchema = z.partialRecord(
  /**
   * The name of the tag.
   */
  z.string(),
  DashboardTagSettingSchema
);

/**
 * Represents the settings for all tags, keyed on the tag name.
 */
export type DashboardTagSettings = z.infer<typeof DashboardTagSettingsSchema>;
