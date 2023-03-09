import CurrentEnv, { OperatingSystemType } from '../../utils/CurrentEnv';
import execCmd from '../cmd';
import { Application } from './applications';

/**
 * Gets the path to the chrome application for the current system given the
 * operating system type.
 *
 * This does include the quotes
 */
function getChromePath(os: OperatingSystemType): string | null {
  switch (os) {
    case OperatingSystemType.MacOSX:
      return `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`;
    case OperatingSystemType.Windows:
      return `& "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"`;
    default:
      return null;
  }
}

/**
 * Opens and sets pinned tabs in chrome. Still trying to figure out
 * how to get this to work.
 */
async function openAndSetPinnedTabs() {
  await execCmd(
    `${getChromePath(
      CurrentEnv.os
    )} --pinned-tab-count=2 https://google.com https://tonyneuhold.com`
  );
}

/**
 * Holds the logic pertaining to interacting with the Chrome application,
 * regardless of which platform it is on.
 */
const chromeApplication: Application = {
  async defaultCall() {
    openAndSetPinnedTabs();
  }
};

export default chromeApplication;
