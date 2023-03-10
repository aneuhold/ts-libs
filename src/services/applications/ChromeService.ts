import CurrentEnv, { OperatingSystemType } from '../../utils/CurrentEnv';
import CLIService from '../CLIService';

/**
 * A service that provides functionality for interacting with the Chrome
 * browser.
 */
export default class ChromeService {
  /**
   * Gets the path to the chrome application for the current system given the
   * operating system type.
   *
   * This does include the quotes
   */
  static getChromePath(os: OperatingSystemType): string | null {
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
  static async openAndSetPinnedTabs(): Promise<void> {
    await CLIService.execCmd(
      `${ChromeService.getChromePath(
        CurrentEnv.os
      )} --pinned-tab-count=2 https://google.com https://tonyneuhold.com`
    );
  }
}
