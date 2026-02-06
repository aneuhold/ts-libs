import {
  NonogramKatanaItemName,
  NonogramKatanaItemSchema,
  UserSchema
} from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import { getTestUserName } from '../../../test-util/testsUtil.js';
import UserRepository from '../common/UserRepository.js';
import DashboardNonogramKatanaItemRepository from './DashboardNonogramKatanaItemRepository.js';

const userRepo = UserRepository.getRepo();
const itemRepo = DashboardNonogramKatanaItemRepository.getRepo();

describe('Create operations', () => {
  it('can create a new nonogram katana item', async () => {
    const newUser = await createNewTestUser();
    const newItem = NonogramKatanaItemSchema.parse({
      userId: newUser._id,
      itemName: NonogramKatanaItemName.Anchor
    });
    const insertResult = await itemRepo.insertNew(newItem);
    expect(insertResult).toBeTruthy();

    const newItemFromDb = await itemRepo.get({ _id: newItem._id });
    expect(newItemFromDb).toBeTruthy();
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
  const newUser = UserSchema.parse({
    userName: getTestUserName(`nonogramKatanaItemTest`)
  });
  newUser.projectAccess.dashboard = true;
  const insertResult = await userRepo.insertNew(newUser);
  expect(insertResult).toBeTruthy();
  return newUser;
}
