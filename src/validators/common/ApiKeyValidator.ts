import { ApiKey } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
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
}
