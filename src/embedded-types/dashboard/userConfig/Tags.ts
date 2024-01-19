export type DashboardTagSettings = { [tag: string]: DashboardTagSetting };

export type DashboardTagSetting = {
  /**
   * Higher priority value means higher priority.
   */
  priority: number;
  color?: string;
};
