import { BaseDocument } from '@aneuhold/core-ts-db-lib';
import { ObjectId } from 'bson';

export type RepoSubscribers<TDocType extends BaseDocument> = {
  insertNew: InsertNewSubscriber<TDocType>[];
  insertMany: InsertManySubscriber<TDocType>[];
  updateMany: UpdateManySubscriber<TDocType>[];
  deleteOne: DeleteOneSubscriber[];
  deleteList: DeleteListSubscriber[];
};

export type RepoListeners<TDocType extends BaseDocument> = {
  insertNew?: InsertNewSubscriber<TDocType>;
  insertMany?: InsertManySubscriber<TDocType>;
  updateMany?: UpdateManySubscriber<TDocType>;
  deleteOne?: DeleteOneSubscriber;
  deleteList?: DeleteListSubscriber;
};

export type InsertNewSubscriber<TDocType extends BaseDocument> = (
  doc: TDocType
) => Promise<void>;

export type InsertManySubscriber<TDocType extends BaseDocument> = (
  docs: TDocType[]
) => Promise<void>;

export type UpdateManySubscriber<TDocType extends BaseDocument> = (
  docs: TDocType[]
) => Promise<void>;

export type DeleteOneSubscriber = (docId: ObjectId) => Promise<void>;

export type DeleteListSubscriber = (docIds: ObjectId[]) => Promise<void>;

/**
 * A subscription service that allows repositories to subscribe to events
 * that happen in other repositories.
 */
export default class RepoSubscriptionService {
  /**
   * A utility method to get a default empty set of subscribers for a
   * repository.
   */
  static getDefaultSubscribers<
    TDocType extends BaseDocument
  >(): RepoSubscribers<TDocType> {
    return {
      insertNew: [],
      insertMany: [],
      updateMany: [],
      deleteOne: [],
      deleteList: []
    };
  }
}
