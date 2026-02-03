import type { BaseDocumentWithType, RequiredUserId } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { BulkWriteResult, DeleteResult, Filter, UpdateResult } from 'mongodb';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import CleanDocument from '../../util/DocumentCleaner.js';
import type IValidator from '../../validators/BaseValidator.js';
import DashboardBaseRepository from './DashboardBaseRepository.js';

/**
 * A base repository for the `dashboard` collection that requires a `userId`.
 */
export default abstract class DashboardBaseWithUserIdRepository<
  TBaseType extends BaseDocumentWithType & RequiredUserId
> extends DashboardBaseRepository<TBaseType> {
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
   * @param userId The ID of the user to get items for.
   */
  async getAllForUser(userId: UUID): Promise<TBaseType[]> {
    const filter = {
      userId
    } as Filter<TBaseType>;
    return this.getListWithFilter(filter);
  }

  /**
   * Gets all items for given users.
   *
   * @param userIds - The user IDs to get items for.
   */
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
      // We get the doc again, because it shouldn't include userId in the update doc.
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
    if (meta && docIds.length > 0) {
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
    const docsForUsers = await this.getAllForUsers(userIds);
    meta?.recordDocTypeTouched(this.docType);
    meta?.addAffectedUserIds(userIds);
    const docIds = docsForUsers.map((doc) => doc._id);
    return this.deleteList(docIds, meta);
  }
}
