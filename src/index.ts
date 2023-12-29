import BaseDocument from './documents/BaseDocument';
import BaseDocumentWithType from './documents/BaseDocumentWithType';
import ApiKey from './documents/common/ApiKey';
import User from './documents/common/User';
import DashboardUserConfig from './documents/dashboard/UserConfig';
import RequiredUserId from './schemas/required-refs/RequiredUserId';

// Export all the functions and classes from this library
export {
  User,
  ApiKey,
  DashboardUserConfig,
  BaseDocument,
  BaseDocumentWithType,
  RequiredUserId
};

// Export TypeScript types where needed
export type {};
