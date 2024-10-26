import { ApiKey, validateApiKey } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils, Logger } from '@aneuhold/core-ts-lib';
import { ObjectId } from 'bson';
import ApiKeyRepository from '../../repositories/common/ApiKeyRepository.js';
import UserRepository from '../../repositories/common/UserRepository.js';
import IValidator from '../BaseValidator.js';

export default class ApiKeyValidator extends IValidator<ApiKey> {
  async validateNewObject(newApiKey: ApiKey): Promise<void> {
    // Check if the user exists
    const userRepo = UserRepository.getRepo();
    const userInDb = await userRepo.get({ _id: newApiKey.userId });
    if (!userInDb) {
      ErrorUtils.throwError(
        `User with ID: ${newApiKey.userId.toString()} does not exist in the database.`,
        newApiKey
      );
      return;
    }
    // Check if the user already has an API key
    const apiKeyRepo = ApiKeyRepository.getRepo();
    const apiKeyInDb = await apiKeyRepo.get({ userId: newApiKey.userId });
    if (apiKeyInDb) {
      ErrorUtils.throwError(
        `User with ID: ${newApiKey.userId.toString()} already has an API key.`,
        newApiKey
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
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

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'API Key',
      allDocs: allApiKeys,
      shouldDelete: (apiKey: ApiKey) => {
        if (!allUserIds[apiKey.userId.toString()]) {
          Logger.error(
            `API Key with ID: ${apiKey._id.toString()} has no valid associated user.`
          );
          return true;
        }
        return false;
      },
      documentValidator: validateApiKey,
      deletionFunction: async (docIdsToDelete: ObjectId[]) => {
        await apiKeyRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: ApiKey[]) => {
        await apiKeyRepo.updateMany(docsToUpdate);
      }
    });
  }
}
