import { User } from '@aneuhold/core-ts-db-lib';
import { afterAll, describe, expect, it } from 'vitest';
import ApiKeyRepository from '../../../repositories/common/ApiKeyRepository.js';
import UserRepository from '../../../repositories/common/UserRepository.js';
import DocumentDb from '../../../util/DocumentDb.js';
import { cleanupDoc, expectToThrow, getTestUserName } from '../../testsUtil.js';

const userRepo = UserRepository.getRepo();

describe('Create operations', () => {
  it('can create a new user', async () => {
    const newUser = new User(getTestUserName());
    const insertResult = await userRepo.insertNew(newUser);
    expect(insertResult).toBeTruthy();

    await cleanupDoc(userRepo, newUser);
  });

  it('can create a new user and the new user gets an API key', async () => {
    const newUser = new User(getTestUserName());
    const insertResult = await userRepo.insertNew(newUser);
    expect(insertResult).toBeTruthy();
    const apiKey = await ApiKeyRepository.getRepo().get({
      userId: newUser._id
    });
    expect(apiKey).toBeTruthy();

    await cleanupDoc(userRepo, newUser);
    const apiKeyThatShouldNotExist = await ApiKeyRepository.getRepo().get({
      userId: newUser._id
    });
    expect(apiKeyThatShouldNotExist).toBeFalsy();
  });

  it('throws if the username is a duplicate username', async () => {
    const duplicateUserName = getTestUserName();
    const newUser1 = new User(duplicateUserName);
    const newUser2 = new User(duplicateUserName);

    const insertResult = await userRepo.insertNew(newUser1);
    expect(insertResult).toBeTruthy();

    await expectToThrow(async () => {
      await userRepo.insertNew(newUser2);
    });

    await cleanupDoc(userRepo, newUser1);
  });
});

describe('Update operations', () => {
  it('succeeds in updating the username if the username doesnt already exist', async () => {
    const userName1 = getTestUserName();
    const userName2 = getTestUserName();
    const newUser = new User(userName1);

    // Insert the user
    const insertResult = await userRepo.insertNew(newUser);
    expect(insertResult).toBeTruthy();

    // Try to update the user
    newUser.userName = userName2;
    const updateResult = await userRepo.update(newUser);
    expect(updateResult.acknowledged).toBeTruthy();

    await cleanupDoc(userRepo, newUser);
  });

  it('throws if no id is defined', async () => {
    const newUser = new User(getTestUserName()) as Partial<User>;
    delete newUser._id;
    await expectToThrow(async () => {
      await userRepo.update(newUser);
    });
  });

  it('throws if the username is updated and already exists', async () => {
    const userName1 = getTestUserName();
    const userName2 = getTestUserName();
    const newUser = new User(userName1);
    const userWithOtherUserName = new User(userName2);

    // Insert the users
    const insertResult1 = await userRepo.insertNew(newUser);
    expect(insertResult1).toBeTruthy();
    const insertResult2 = await userRepo.insertNew(userWithOtherUserName);
    expect(insertResult2).toBeTruthy();

    // Try to update the first user
    newUser.userName = userName2;
    await expectToThrow(async () => {
      await userRepo.update(newUser);
    });

    await Promise.all([
      cleanupDoc(userRepo, newUser),
      cleanupDoc(userRepo, userWithOtherUserName)
    ]);
  });

  it('throws if the user doesnt exist', async () => {
    const newUser = new User(getTestUserName());

    // Try to update the user
    await expectToThrow(async () => {
      await userRepo.update(newUser);
    });
  });
});

afterAll(async () => {
  await DocumentDb.closeDbConnection();
});
