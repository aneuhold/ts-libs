import {
  NonogramKatanaItem,
  NonogramKatanaItemName,
  User
} from '@aneuhold/core-ts-db-lib';
import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import UserRepository from '../../../repositories/common/UserRepository.js';
import DashboardNonogramKatanaItemRepository from '../../../repositories/dashboard/DashboardNonogramKatanaItemRepository.js';
import { cleanupDoc, getTestUserName } from '../../testsUtil.js';

const userRepo = UserRepository.getRepo();
const itemRepo = DashboardNonogramKatanaItemRepository.getRepo();

describe('Create operations', () => {
  it('can create a new nonogram katana item', async () => {
    const newUser = await createNewTestUser();
    const newItem = new NonogramKatanaItem(
      newUser._id,
      NonogramKatanaItemName.Anchor
    );
    const insertResult = await itemRepo.insertNew(newItem);
    expect(insertResult).toBeTruthy();

    const newItemFromDb = await itemRepo.get({ _id: newItem._id });
    expect(newItemFromDb).toBeTruthy();

    await cleanupDoc(userRepo, newUser);
  });
});

/**
 * Deletes all Nonogram Katana Items!
 *
 * To just do a cleanup, put `only` after `it`. So `it.only('can delete all items'`
 */
it.skip('can delete all items', async () => {
  const result = await itemRepo.deleteAll();
  expect(result.acknowledged).toBeTruthy();
});

/**
 * Create a new test user
 *
 * @returns The new user
 */
async function createNewTestUser() {
  const newUser = new User(
    getTestUserName(`${crypto.randomUUID()}nonogramKatanaItemTest`)
  );
  newUser.projectAccess.dashboard = true;
  const insertResult = await userRepo.insertNew(newUser);
  expect(insertResult).toBeTruthy();
  return newUser;
}
