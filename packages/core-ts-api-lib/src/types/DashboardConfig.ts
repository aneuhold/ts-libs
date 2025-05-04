/**
 * The config for the dashboard project that is returned to every authenticated
 * user inside that project.
 */
export type DashboardConfig = {
  projectDashboardFunctionUrl: string;
  automationUrls: {
    sunLight: string;
    zoomLighting: string;
    bedTimeButStillWatchingShows: string;
    bedTime: string;
    sunrise: string;
  };
};
