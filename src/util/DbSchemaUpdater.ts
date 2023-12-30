import ApiKeyValidator from '../validators/common/ApiKeyValidator';

/**
 * A class that can be used to validate and update the DB and all repositories.
 */
export default class DbSchemaUpdater {
  static async updateSchemaForAllRepos(dryRun = false): Promise<void> {
    await new ApiKeyValidator().validateRepositoryInDb(dryRun);
  }
}
