import chromeApplication from './chromeApplication';
import fileSystemApplication from './fileSystemApplication';

export type Application = {
  defaultCall: () => Promise<void>;
  [functionName: string]: unknown;
};

/**
 * The list of app names that are possible. These can be aliases to specific
 * operations as well. This is the single source of truth.
 */
export enum AppName {
  chrome = 'chrome',
  nugetCache = 'nugetCache'
}

/**
 * Holds logic pertaining to running and using individual applications on the
 * current system.
 */
const applications: { [appName in AppName]: Application } = {
  chrome: chromeApplication,
  nugetCache: fileSystemApplication
};

export default applications;
