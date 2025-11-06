import sleep from './helperFunctions/sleep.js';
import { ILogger, NoopLogger } from './interfaces/ILogger.js';
import { ISpan, ITracer, NoopTracer } from './interfaces/ITracer.js';
import ArrayService from './services/ArrayService.js';
import DateService from './services/DateService/DateService.js';
import { DependencyRegistry, DR } from './services/DependencyRegistry.js';
import StringService from './services/StringService.js';
import { PackageJson } from './types/PackageJson.js';
import { VersionType } from './types/VersionType.js';
import ErrorUtils from './utils/ErrorUtils.js';
import TestUtils from './utils/TestUtils.js';

// Export all browser-safe functions and classes from this library
export {
  ArrayService,
  DateService,
  DependencyRegistry,
  DR,
  ErrorUtils,
  NoopLogger,
  NoopTracer,
  sleep,
  StringService,
  TestUtils
};

// Export TypeScript types where needed
export type { ILogger, ISpan, ITracer, PackageJson, VersionType };
