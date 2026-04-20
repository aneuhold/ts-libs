import sleep from './helperFunctions/sleep.js';
import type { ILogger } from './interfaces/ILogger.js';
import { NoopLogger } from './interfaces/ILogger.js';
import type { ISpan, ITracer } from './interfaces/ITracer.js';
import { NoopTracer } from './interfaces/ITracer.js';
import ArrayService from './services/ArrayService.js';
import DateService from './services/DateService/DateService.js';
import { DependencyRegistry, DR } from './services/DependencyRegistry.js';
import StringService from './services/StringService.js';
import type { DeepPartial } from './types/DeepPartial.js';
import type { JsonWithVersionProperty } from './types/JsonWithVersionProperty.js';
import { isJsonWithVersionProperty } from './types/JsonWithVersionProperty.js';
import type { PackageJson } from './types/PackageJson.js';
import { isPackageJson } from './types/PackageJson.js';
import { VersionType } from './types/VersionType.js';
import ErrorUtils from './utils/ErrorUtils.js';
import JsonUtils from './utils/JsonUtils.js';
import TestUtils from './utils/TestUtils.js';

// Export all browser-safe functions and classes from this library
export {
  ArrayService,
  DateService,
  DependencyRegistry,
  DR,
  ErrorUtils,
  isJsonWithVersionProperty,
  isPackageJson,
  JsonUtils,
  NoopLogger,
  NoopTracer,
  sleep,
  StringService,
  TestUtils,
  VersionType
};

// Export TypeScript types where needed
export type { DeepPartial, ILogger, ISpan, ITracer, JsonWithVersionProperty, PackageJson };
