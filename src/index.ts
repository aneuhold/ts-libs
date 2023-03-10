import applications, {
  AppName
} from './helperFunctions/applications/applications';
import execCmd, { execCmdWithTimeout } from './helperFunctions/cmd';
import datesAreOnSameDay from './helperFunctions/dateFunctions';
import findAndInsertText from './helperFunctions/fileFunctions';
import getUserInput from './helperFunctions/input';
import sleep from './helperFunctions/sleep';
import getFileNameExtension from './helperFunctions/stringFunctions';
import CurrentEnv, {
  OperatingSystemType,
  ShellType,
  TerminalType
} from './utils/CurrentEnv';
import Log from './utils/Log';

// Export all the functions and classes from this library
export {
  execCmd,
  execCmdWithTimeout,
  CurrentEnv,
  applications,
  AppName,
  Log,
  sleep,
  getUserInput,
  findAndInsertText,
  OperatingSystemType,
  ShellType,
  TerminalType,
  datesAreOnSameDay,
  getFileNameExtension
};
