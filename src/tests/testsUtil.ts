import { BaseDocument } from '@aneuhold/core-ts-db-lib';
import BaseRepository from '../repositories/BaseRepository';

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
