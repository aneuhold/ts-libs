import { sleep } from '@aneuhold/core-ts-lib';
import CLIService from './services/CLIService';
import ChromeService from './services/applications/ChromeService';
import DockerService from './services/applications/DockerService';
import OSFileSystemService from './services/applications/OSFileSystemService';
import CurrentEnv, {
  OperatingSystemType,
  ShellType,
  TerminalType
} from './utils/CurrentEnv';
import ITermService from './services/applications/ITermService';
import ConfigService from './services/ConfigService/ConfigService';
import Config from './services/ConfigService/ConfigDefinition';
import TranslationService, {
  TranslationProject
} from './services/TranslationService/TranslationService';

// Export all the functions and classes from this library
export {
  CLIService,
  CurrentEnv,
  ChromeService,
  DockerService,
  OSFileSystemService,
  sleep,
  OperatingSystemType,
  ShellType,
  TerminalType,
  ITermService,
  ConfigService,
  TranslationService
};

// Export TypeScript types where needed
export type { Config, TranslationProject };
