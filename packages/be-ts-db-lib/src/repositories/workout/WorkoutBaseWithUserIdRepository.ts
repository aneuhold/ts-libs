import type {
  BaseDocumentWithType,
  BaseDocumentWithUpdatedAndCreatedDates,
  RequiredUserId
} from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { BulkWriteResult, DeleteResult, Filter, UpdateResult } from 'mongodb';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import CleanDocument from '../../util/DocumentCleaner.js';
import type IValidator from '../../validators/BaseValidator.js';
import WorkoutBaseRepository from './WorkoutBaseRepository.js';

/**
 * A base repository for the `workout` collection that requires a `userId`.
 */
export default abstract class WorkoutBaseWithUserIdRepository<
  TBaseType extends BaseDocumentWithType & BaseDocumentWithUpdatedAndCreatedDates & RequiredUserId
> extends WorkoutBaseRepository<TBaseType> {
  constructor(
    docType: string,
    validator: IValidator<TBaseType>,
    updateCleaner?: (doc: Partial<TBaseType>) => Partial<TBaseType>
  ) {
    const defaultUpdateCleaner = (doc: Partial<TBaseType>) =>
      updateCleaner ? updateCleaner(CleanDocument.userId(doc)) : CleanDocument.userId(doc);
    super(docType, validator, defaultUpdateCleaner);
  }

  /**
   * Gets all items for a given user.
   *
   * @param userId - The user ID to get items for.
   */
  async getAllForUser(userId: UUID): Promise<TBaseType[]> {
    return this.getAllForUsers([userId]);
  }

  async getAllForUsers(userIds: UUID[]): Promise<TBaseType[]> {
    const filter = {
      userId: { $in: userIds }
    } as Filter<TBaseType>;
    return this.getListWithFilter(filter);
  }

  override async insertNew(
    newDoc: TBaseType,
    meta?: DbOperationMetaData
  ): Promise<TBaseType | null> {
    const result = await super.insertNew(newDoc, meta);
    if (result) {
      meta?.addAffectedUserIds([result.userId]);
    }
    return result;
  }

  override async insertMany(
    newDocs: TBaseType[],
    meta?: DbOperationMetaData
  ): Promise<TBaseType[]> {
    const result = await super.insertMany(newDocs, meta);
    meta?.addAffectedUserIds(result.map((d) => d.userId));
    return result;
  }

  override async update(
    updatedDoc: Partial<TBaseType>,
    meta?: DbOperationMetaData
  ): Promise<UpdateResult> {
    if (meta && updatedDoc._id) {
      const docs = await this.fetchAndCacheDocsForMeta([updatedDoc._id], meta);
      if (docs.length > 0) {
        meta.addAffectedUserIds([docs[0].userId]);
      }
    }
    return super.update(updatedDoc, meta);
  }

  override async updateMany(
    updatedDocs: Partial<TBaseType>[],
    meta?: DbOperationMetaData
  ): Promise<BulkWriteResult> {
    if (meta && updatedDocs.length > 0) {
      const docIds = updatedDocs.map((doc) => doc._id).filter((id): id is UUID => id !== undefined);
      const cachedDocs = await this.fetchAndCacheDocsForMeta(docIds, meta);
      meta.addAffectedUserIds(cachedDocs.map((doc) => doc.userId));
    }
    return super.updateMany(updatedDocs, meta);
  }

  override async delete(docId: UUID, meta?: DbOperationMetaData): Promise<DeleteResult> {
    if (meta) {
      const docs = await this.fetchAndCacheDocsForMeta([docId], meta);
      if (docs.length > 0) {
        meta.addAffectedUserIds([docs[0].userId]);
      }
    }
    return super.delete(docId, meta);
  }

  override async deleteList(docIds: UUID[], meta?: DbOperationMetaData): Promise<DeleteResult> {
    if (meta) {
      const cachedDocs = await this.fetchAndCacheDocsForMeta(docIds, meta);
      meta.addAffectedUserIds(cachedDocs.map((doc) => doc.userId));
    }
    return super.deleteList(docIds, meta);
  }

  /**
   * Deletes all documents for a specific user.
   *
   * @param userId - The user ID to delete documents for.
   * @param meta - Tracks database operation metadata for a single request.
   */
  async deleteAllForUser(userId: UUID, meta?: DbOperationMetaData): Promise<DeleteResult> {
    return this.deleteAllForUsers([userId], meta);
  }

  /**
   * Deletes all documents for specific users.
   *
   * @param userIds - The user IDs to delete documents for.
   * @param meta - Tracks database operation metadata for a single request.
   */
  async deleteAllForUsers(userIds: UUID[], meta?: DbOperationMetaData): Promise<DeleteResult> {
    // This does mean we are retrieving all documents twice, because deleteList also fetches them.
    // That isn't very efficient, but at the moment of writing this, it seemed fine because this
    // operation shouldn't be used very often at all.
    const docsForUsers = await this.getAllForUsers(userIds);
    meta?.recordDocTypeTouched(this.docType);
    meta?.addAffectedUserIds(userIds);
    const docIds = docsForUsers.map((doc) => doc._id);
    return this.deleteList(docIds, meta);
  }
}
