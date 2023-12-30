import { ApiKey } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils, Logger } from '@aneuhold/core-ts-lib';
import { ObjectId } from 'bson';
import { validateApiKey } from '@aneuhold/core-ts-db-lib/lib/documents/common/ApiKey';
import UserRepository from '../../repositories/common/UserRepository';
import IValidator from '../BaseValidator';
import ApiKeyRepository from '../../repositories/common/ApiKeyRepository';

export default class ApiKeyValidator extends IValidator<ApiKey> {
  async validateNewObject(newApiKey: ApiKey): Promise<void> {
    // Check if the user exists
    const userRepo = UserRepository.getRepo();
    const userInDb = await userRepo.get({ _id: newApiKey.userId });
    if (!userInDb) {
      ErrorUtils.throwError(
        `User with ID: ${newApiKey.userId} does not exist in the database.`,
        newApiKey
      );
      return;
    }
    // Check if the user already has an API key
    const apiKeyRepo = ApiKeyRepository.getRepo();
    const apiKeyInDb = await apiKeyRepo.get({ userId: newApiKey.userId });
    if (apiKeyInDb) {
      ErrorUtils.throwError(
        `User with ID: ${newApiKey.userId} already has an API key.`,
        newApiKey
      );
    }
  }

  async validateUpdateObject(updatedApiKey: Partial<ApiKey>): Promise<void> {
    // Throw, because API keys should not be updated. Only created and deleted.
    ErrorUtils.throwError(
      `API keys should not be updated at this time. Only created and deleted.`,
      updatedApiKey
    );
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const apiKeyRepo = ApiKeyRepository.getRepo();
    const allApiKeys = await apiKeyRepo.getAll();
    const allUserIds = await UserRepository.getRepo().getAllIdsAsHash();
    const apiKeysToDelete: Array<ObjectId> = [];
    const apiKeysToValidate: Array<ApiKey> = [];
    const apiKeysToUpdate: Array<ApiKey> = [];

    // Check that all API Keys have a valid user
    allApiKeys.forEach((apiKey) => {
      if (!allUserIds[apiKey.userId.toString()]) {
        Logger.error(
          `API Key with ID: ${apiKey._id} has no valid associated user.`
        );
        apiKeysToDelete.push(apiKey._id);
      } else {
        apiKeysToValidate.push(apiKey);
      }
    });
    // Validate the rest
    let numInvalidDocs = 0;
    apiKeysToValidate.forEach((apiKey) => {
      const { updatedDoc, errors } = validateApiKey(apiKey);
      if (errors.length !== 0) {
        Logger.error(`API Key with ID: ${apiKey._id} is invalid. Errors:`);
        numInvalidDocs += 1;
        errors.forEach((error) => {
          Logger.error(error);
        });
        apiKeysToUpdate.push(updatedDoc);
      }
    });
    if (dryRun) {
      if (numInvalidDocs === 0) {
        Logger.info(`No invalid API keys found.`);
      } else {
        Logger.info(`Would update ${numInvalidDocs} API keys in the database.`);
      }
      if (apiKeysToDelete.length === 0) {
        Logger.info(`No API keys to delete found.`);
      } else {
        Logger.info(
          `Would delete ${apiKeysToDelete.length} API keys in the database.`
        );
      }
      return;
    }
    // Delete all invalid
    if (apiKeysToDelete.length !== 0) {
      await apiKeyRepo.deleteList(apiKeysToDelete);
    }
    // Update all that need to be updated
    if (apiKeysToUpdate.length !== 0) {
      await apiKeyRepo.updateMany(apiKeysToUpdate);
    }
  }
}
