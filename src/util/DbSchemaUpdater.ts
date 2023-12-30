import ApiKeyValidator from '../validators/common/ApiKeyValidator';
import UserValidator from '../validators/common/UserValidator';
import DashboardUserConfigValidator from '../validators/dashboard/UserConfigValidator';

/**
 * A class that can be used to validate and update the DB and all repositories.
 */
export default class DbSchemaUpdater {
  static async updateSchemaForAllRepos(dryRun = false): Promise<void> {
    await new UserValidator().validateRepositoryInDb(dryRun);
    await new ApiKeyValidator().validateRepositoryInDb(dryRun);
    await new DashboardUserConfigValidator().validateRepositoryInDb(dryRun);
  }
}
