import { BaseDocument } from '@aneuhold/core-ts-db-lib';
import crypto from 'crypto';
import { expect } from 'vitest';
import BaseRepository from '../repositories/BaseRepository.js';
import { TEST_USER_NAME_PREFIX } from './globalTestVariables.js';

/**
 * Asserts that the provided asynchronous function throws an error.
 *
 * @param func - The asynchronous function expected to throw an error.
 */
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
 *
 * @param username - The username to use as a base for the test user name.
 * @returns The test user name.
 */
export function getTestUserName(username?: string): string {
  if (!username) return `${TEST_USER_NAME_PREFIX}-${crypto.randomUUID()}`;
  return `${TEST_USER_NAME_PREFIX}-${username}`;
}

/**
 * Cleans up a document by deleting it from the repository and verifying its deletion.
 *
 * @template TDocType - The type of the document extending {@link BaseDocument}.
 * @param repo - The repository from which the document will be deleted.
 * @param doc - The document to be deleted.
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

/**
 * Cleans up the specified documents from the repository.
 *
 * @template TDocType - The type of the documents.
 * @param repo - The repository from which to delete the documents.
 * @param docs - The documents to be deleted.
 * @returns A promise that resolves when the cleanup is complete.
 */
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
