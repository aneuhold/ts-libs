import { UserSchema } from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import { getTestUserName } from '../../../test-util/testsUtil.js';
import ApiKeyRepository from './ApiKeyRepository.js';
import UserRepository from './UserRepository.js';

const userRepo = UserRepository.getRepo();
const apiKeyRepo = ApiKeyRepository.getRepo();

describe('Unit Tests', () => {
  describe('Lifecycle with User', () => {
    it('creates an API key when a user is created', async () => {
      const newUser = UserSchema.parse({ userName: getTestUserName() });
      const insertResult = await userRepo.insertNew(newUser);
      expect(insertResult).toBeTruthy();

      const apiKey = await apiKeyRepo.get({ userId: newUser._id });
      expect(apiKey).toBeTruthy();
      expect(apiKey?.userId).toBe(newUser._id);
    });

    it('deletes the API key when the associated user is deleted', async () => {
      const newUser = UserSchema.parse({ userName: getTestUserName() });
      await userRepo.insertNew(newUser);

      const apiKeyBefore = await apiKeyRepo.get({ userId: newUser._id });
      expect(apiKeyBefore).toBeTruthy();

      await userRepo.delete(newUser._id);

      const apiKeyAfter = await apiKeyRepo.get({ userId: newUser._id });
      expect(apiKeyAfter).toBeNull();
    });
  });
});
