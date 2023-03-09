import CurrentEnv, { OperatingSystemType } from '../../utils/CurrentEnv';
import execCmd from '../cmd';
import { Application } from './applications';

async function openWindowsNugetCache() {
  await Promise.all([
    execCmd(`ii $HOME/localNuget`),
    execCmd(`ii $HOME/.nuget/packages`)
  ]);
}

async function openNugetCache() {
  if (CurrentEnv.os === OperatingSystemType.Windows) {
    await openWindowsNugetCache();
  }
}

/**
 * Holds the logic pertaining to interacting with the Chrome application,
 * regardless of which platform it is on.
 */
const fileSystemApplication: Application = {
  async defaultCall() {
    await openNugetCache();
  }
};

export default fileSystemApplication;
