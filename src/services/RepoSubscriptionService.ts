import { BaseDocument } from '@aneuhold/core-ts-db-lib';
import { ObjectId } from 'bson';
import UserRepository from '../repositories/common/UserRepository';
import ApiKeyRepository from '../repositories/common/ApiKeyRepository';
import DashboardUserConfigRepository from '../repositories/dashboard/UserConfigRepository';

export type RepoSubscribers<TDocType extends BaseDocument> = {
  insertNew: InsertNewSubscriber<TDocType>[];
  updateMany: UpdateManySubscriber<TDocType>[];
  deleteOne: DeleteOneSubscriber[];
  deleteList: DeleteListSubscriber[];
};

export type RepoListeners<TDocType extends BaseDocument> = {
  insertNew?: InsertNewSubscriber<TDocType>;
  updateMany?: UpdateManySubscriber<TDocType>;
  deleteOne?: DeleteOneSubscriber;
  deleteList?: DeleteListSubscriber;
};

export type InsertNewSubscriber<TDocType extends BaseDocument> = (
  doc: TDocType
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
  private static allRepoSetupFunctions: Array<() => void> = [
    UserRepository.getRepo().setupListeners,
    ApiKeyRepository.getRepo().setupListeners,
    DashboardUserConfigRepository.getRepo().setupListeners
  ];

  private static allRepoSetupFunctionsRan = false;

  static checkOrAttachListeners() {
    if (!this.allRepoSetupFunctionsRan) {
      this.allRepoSetupFunctions.forEach((func) => func());
      this.allRepoSetupFunctionsRan = true;
    }
  }

  /**
   * A utility method to get a default empty set of subscribers for a
   * repository.
   */
  static getDefaultSubscribers<
    TDocType extends BaseDocument
  >(): RepoSubscribers<TDocType> {
    return {
      insertNew: [],
      updateMany: [],
      deleteOne: [],
      deleteList: []
    };
  }
}
