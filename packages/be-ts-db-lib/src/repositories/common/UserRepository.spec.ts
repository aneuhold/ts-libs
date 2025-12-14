import type { User } from '@aneuhold/core-ts-db-lib';
import { UserSchema } from '@aneuhold/core-ts-db-lib';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupDoc, expectToThrow, getTestUserName } from '../../tests/testsUtil.js';
import DocumentDb from '../../util/DocumentDb.js';
import ApiKeyRepository from './ApiKeyRepository.js';
import UserRepository from './UserRepository.js';

const userRepo = UserRepository.getRepo();

describe('Create operations', () => {
  it('can create a new user', async () => {
    const newUser = UserSchema.parse({ userName: getTestUserName() });
    const insertResult = await userRepo.insertNew(newUser);
    expect(insertResult).toBeTruthy();

    await cleanupDoc(userRepo, newUser);
  });

  it('can create a new user and the new user gets an API key', async () => {
    const newUser = UserSchema.parse({ userName: getTestUserName() });
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
    const newUser1 = UserSchema.parse({ userName: duplicateUserName });
    const newUser2 = UserSchema.parse({ userName: duplicateUserName });

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
    const newUser = UserSchema.parse({ userName: userName1 });

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
    const newUser = UserSchema.parse({ userName: getTestUserName() }) as Partial<User>;
    delete newUser._id;
    await expectToThrow(async () => {
      await userRepo.update(newUser);
    });
  });

  it('throws if the username is updated and already exists', async () => {
    const userName1 = getTestUserName();
    const userName2 = getTestUserName();
    const newUser = UserSchema.parse({ userName: userName1 });
    const userWithOtherUserName = UserSchema.parse({ userName: userName2 });

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

    await Promise.all([cleanupDoc(userRepo, newUser), cleanupDoc(userRepo, userWithOtherUserName)]);
  });

  it('throws if the user doesnt exist', async () => {
    const newUser = UserSchema.parse({ userName: getTestUserName() });

    // Try to update the user
    await expectToThrow(async () => {
      await userRepo.update(newUser);
    });
  });

  it('can update with a partial object containing only _id and userName', async () => {
    const userName1 = getTestUserName();
    const userName2 = getTestUserName();
    const newUser = UserSchema.parse({ userName: userName1 });

    // Insert the user
    const insertResult = await userRepo.insertNew(newUser);
    expect(insertResult).toBeTruthy();

    // Update with only _id and userName
    const partialUpdate: Partial<User> = {
      _id: newUser._id,
      userName: userName2
    };
    const updateResult = await userRepo.update(partialUpdate);
    expect(updateResult.acknowledged).toBeTruthy();

    // Verify the update worked
    const updatedUser = await userRepo.get({ _id: newUser._id });
    expect(updatedUser?.userName).toBe(userName2);

    await cleanupDoc(userRepo, newUser);
  });

  it('can update with a partial object containing only _id', async () => {
    const userName = getTestUserName();
    const newUser = UserSchema.parse({ userName });

    // Insert the user
    const insertResult = await userRepo.insertNew(newUser);
    expect(insertResult).toBeTruthy();

    // Update with only _id (no changes)
    const partialUpdate: Partial<User> = {
      _id: newUser._id
    };
    const updateResult = await userRepo.update(partialUpdate);
    expect(updateResult.acknowledged).toBeTruthy();

    await cleanupDoc(userRepo, newUser);
  });

  it('does not clear nullish fields when not included in partial update, but clears when explicitly set to null', async () => {
    const userName = getTestUserName();
    const testEmail = 'test@example.com';
    const newUser = UserSchema.parse({ userName, email: testEmail });

    // Insert the user with an email
    const insertResult = await userRepo.insertNew(newUser);
    expect(insertResult).toBeTruthy();

    // Verify email was set
    let userInDb = await userRepo.get({ _id: newUser._id });
    expect(userInDb?.email).toBe(testEmail);

    // Update userName only - email should NOT be cleared
    const partialUpdate: Partial<User> = {
      _id: newUser._id,
      userName: getTestUserName()
    };
    const updateResult = await userRepo.update(partialUpdate);
    expect(updateResult.acknowledged).toBeTruthy();

    // Verify email is still present
    userInDb = await userRepo.get({ _id: newUser._id });
    expect(userInDb?.email).toBe(testEmail);

    // Now explicitly set email to null
    const clearEmailUpdate: Partial<User> = {
      _id: newUser._id,
      email: null
    };
    const clearResult = await userRepo.update(clearEmailUpdate);
    expect(clearResult.acknowledged).toBeTruthy();

    // Verify email is now cleared
    userInDb = await userRepo.get({ _id: newUser._id });
    expect(userInDb?.email).toBeNull();

    await cleanupDoc(userRepo, newUser);
  });
});

afterAll(async () => {
  await DocumentDb.closeDbConnection();
});
