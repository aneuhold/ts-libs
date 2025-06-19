import sleep from './helperFunctions/sleep.js';
import { ILogger } from './interfaces/ILogger.js';
import { ISpan, ITracer } from './interfaces/ITracer.js';
import ArrayService from './services/ArrayService.js';
import ChangelogService from './services/ChangelogService/index.js';
import DateService from './services/DateService/DateService.js';
import { DependencyRegistry, DR } from './services/DependencyRegistry.js';
import DependencyService, { VersionType } from './services/DependencyService.js';
import FileSystemService, {
  type ReplaceInFilesOptions
} from './services/FileSystemService/FileSystemService.js';
import GlobMatchingService from './services/FileSystemService/GlobMatchingService.js';
import PackageService from './services/PackageService/PackageService.js';
import StringService from './services/StringService.js';
import { PackageJson } from './types/PackageJson.js';
import ErrorUtils from './utils/ErrorUtils.js';
import TestUtils from './utils/TestUtils.js';

// Export all the functions and classes from this library
export {
  ArrayService,
  ChangelogService,
  DateService,
  DependencyRegistry,
  DependencyService,
  DR,
  ErrorUtils,
  FileSystemService,
  GlobMatchingService,
  PackageService,
  sleep,
  StringService,
  TestUtils
};

// Export TypeScript types where needed
export type { ILogger, ISpan, ITracer, PackageJson, ReplaceInFilesOptions, VersionType };
