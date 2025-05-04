/**
 * Represents the settings for all tags, keyed on the tag name.
 */
export type DashboardTagSettings = { [tag: string]: DashboardTagSetting };

/**
 * Represents a setting for an individual tag.
 */
export type DashboardTagSetting = {
  /**
   * Higher priority value means higher priority.
   */
  priority: number;
  color?: string;
};
