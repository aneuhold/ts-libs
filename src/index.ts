import datesAreOnSameDay from './helperFunctions/dateFunctions';
import sleep from './helperFunctions/sleep';
import DependencyService from './services/DependencyService';
import DOFunctionService, {
  DOFunction
} from './services/DOFunctionService/DOFunctionService';
import {
  DOAuthCheckPasswordInput,
  DOAuthCheckPasswordOutput,
  DOAuthCheckPasswordRawOutput
} from './services/DOFunctionService/functionsInfo/authCheckPassword';
import FileSystemService from './services/FileSystemService/FileSystemService';
import StringService from './services/StringService';
import ErrorUtils from './utils/ErrorUtils';
import Logger from './utils/Logger';
import TestUtils from './utils/TestUtils';

// Export all the functions and classes from this library
export {
  datesAreOnSameDay,
  DependencyService,
  DOFunctionService,
  FileSystemService,
  Logger,
  sleep,
  StringService,
  TestUtils,
  ErrorUtils
};

// Export TypeScript types where needed
export type {
  DOAuthCheckPasswordInput,
  DOAuthCheckPasswordOutput,
  DOAuthCheckPasswordRawOutput,
  DOFunction
};
