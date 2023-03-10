import datesAreOnSameDay from './helperFunctions/dateFunctions';
import sleep from './helperFunctions/sleep';
import getFileNameExtension from './helperFunctions/stringFunctions';
import ChromeService from './services/applications/ChromeService';
import FileSystemService from './services/applications/FileSystemService';
import CLIService from './services/CLIService';
import StringService from './services/StringService';
import CurrentEnv, {
  OperatingSystemType,
  ShellType,
  TerminalType
} from './utils/CurrentEnv';
import Logger from './utils/Logger';

// Export all the functions and classes from this library
export {
  CLIService,
  StringService,
  CurrentEnv,
  ChromeService,
  FileSystemService,
  sleep,
  OperatingSystemType,
  ShellType,
  Logger,
  TerminalType,
  datesAreOnSameDay,
  getFileNameExtension
};
