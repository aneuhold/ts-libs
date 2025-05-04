import ApiKeyValidator from '../validators/common/ApiKeyValidator.js';
import UserValidator from '../validators/common/UserValidator.js';
import DashboardTaskValidator from '../validators/dashboard/TaskValidator.js';
import DashboardUserConfigValidator from '../validators/dashboard/UserConfigValidator.js';

/**
 * A class that can be used to validate and update the DB and all repositories.
 */
export default class DbSchemaUpdater {
  static async updateSchemaForAllRepos(dryRun = false): Promise<void> {
    await new UserValidator().validateRepositoryInDb(dryRun);
    await new ApiKeyValidator().validateRepositoryInDb(dryRun);
    await new DashboardUserConfigValidator().validateRepositoryInDb(dryRun);
    await new DashboardTaskValidator().validateRepositoryInDb(dryRun);
  }
}
