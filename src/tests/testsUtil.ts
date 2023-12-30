import { BaseDocument } from '@aneuhold/core-ts-db-lib';
import crypto from 'crypto';
import BaseRepository from '../repositories/BaseRepository';

/**
 * A random series of characters for tests to help identify test users.
 */
export const TEST_USER_NAME_PREFIX = 'lkahwsetpiohweat';

export async function expectToThrow(func: () => Promise<void>) {
  let threwError = false;
  try {
    await func();
  } catch {
    threwError = true;
  }
  expect(threwError).toBeTruthy();
}

/**
 * Gets a test user name with a standardized prefix so that they can all be
 * identified and deleted if anything goes wrong in the tests.
 */
export function getTestUserName(username?: string) {
  if (!username) return `${TEST_USER_NAME_PREFIX}-${crypto.randomUUID()}`;
  return `${TEST_USER_NAME_PREFIX}-${username}`;
}

/**
 * Removes the provided doc from the DB
 */
export async function cleanupDoc<TDocType extends BaseDocument>(
  repo: BaseRepository<TDocType>,
  doc: TDocType
) {
  const deleteResult = await repo.delete(doc._id);
  expect(deleteResult.acknowledged).toBeTruthy();
  const findResult = await repo.get({ _id: doc._id } as Partial<TDocType>);
  expect(findResult).toBeNull();
}

export async function cleanupDocs<TDocType extends BaseDocument>(
  repo: BaseRepository<TDocType>,
  docs: TDocType[]
) {
  const idsToDelete = docs.map((doc) => doc._id);
  const deleteResult = await repo.deleteList(idsToDelete);
  expect(deleteResult.acknowledged).toBeTruthy();
  const findResult = await repo.getList(idsToDelete);
  expect(findResult.length).toBe(0);
}
