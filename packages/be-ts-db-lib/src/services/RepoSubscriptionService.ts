import type { BaseDocument } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';

export type RepoSubscribers<TDocType extends BaseDocument> = {
  insertNew: InsertNewSubscriber<TDocType>[];
  insertMany: InsertManySubscriber<TDocType>[];
  updateOne: UpdateOneSubscriber<TDocType>[];
  updateMany: UpdateManySubscriber<TDocType>[];
  deleteOne: DeleteOneSubscriber[];
  deleteList: DeleteListSubscriber[];
};

export type RepoListeners<TDocType extends BaseDocument> = {
  insertNew?: InsertNewSubscriber<TDocType>;
  insertMany?: InsertManySubscriber<TDocType>;
  updateOne?: UpdateOneSubscriber<TDocType>;
  updateMany?: UpdateManySubscriber<TDocType>;
  deleteOne?: DeleteOneSubscriber;
  deleteList?: DeleteListSubscriber;
};

export type InsertNewSubscriber<TDocType extends BaseDocument> = (doc: TDocType) => Promise<void>;

export type InsertManySubscriber<TDocType extends BaseDocument> = (
  docs: TDocType[]
) => Promise<void>;

export type UpdateOneSubscriber<TDocType extends BaseDocument> = (
  doc: Partial<TDocType>
) => Promise<void>;

export type UpdateManySubscriber<TDocType extends BaseDocument> = (
  docs: Partial<TDocType>[]
) => Promise<void>;

export type DeleteOneSubscriber = (docId: UUID) => Promise<void>;

export type DeleteListSubscriber = (docIds: UUID[]) => Promise<void>;

/**
 * A subscription service that allows repositories to subscribe to events
 * that happen in other repositories.
 */
export default class RepoSubscriptionService {
  /**
   * A utility method to get a default empty set of subscribers for a
   * repository.
   */
  static getDefaultSubscribers<TDocType extends BaseDocument>(): RepoSubscribers<TDocType> {
    return {
      insertNew: [],
      insertMany: [],
      updateOne: [],
      updateMany: [],
      deleteOne: [],
      deleteList: []
    };
  }
}
