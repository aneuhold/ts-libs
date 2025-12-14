import type { BaseDocumentWithType } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { BulkWriteResult, DeleteResult, UpdateResult } from 'mongodb';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import CleanDocument from '../../util/DocumentCleaner.js';
import type IValidator from '../../validators/BaseValidator.js';
import BaseRepository from '../BaseRepository.js';

/**
 * A base repository for the `dashboard` collection.
 */
export default abstract class DashboardBaseRepository<
  TBaseType extends BaseDocumentWithType
> extends BaseRepository<TBaseType> {
  private static COLLECTION_NAME = 'dashboard';

  constructor(
    protected docType: string,
    validator: IValidator<TBaseType>,
    updateCleaner?: (doc: Partial<TBaseType>) => Partial<TBaseType>
  ) {
    const defaultUpdateCleaner = (updatedDoc: Partial<TBaseType>) =>
      updateCleaner
        ? updateCleaner(CleanDocument.docType(updatedDoc))
        : CleanDocument.docType(updatedDoc);
    const defaultFilter = { docType } as Partial<TBaseType>;
    super(DashboardBaseRepository.COLLECTION_NAME, validator, defaultFilter, defaultUpdateCleaner);
  }

  override async insertNew(
    newDoc: TBaseType,
    meta?: DbOperationMetaData
  ): Promise<TBaseType | null> {
    meta?.recordDocTypeTouched(this.docType);
    return super.insertNew(newDoc, meta);
  }

  override async insertMany(
    newDocs: TBaseType[],
    meta?: DbOperationMetaData
  ): Promise<TBaseType[]> {
    meta?.recordDocTypeTouched(this.docType);
    return super.insertMany(newDocs, meta);
  }

  override async update(
    updatedDoc: Partial<TBaseType>,
    meta?: DbOperationMetaData
  ): Promise<UpdateResult> {
    meta?.recordDocTypeTouched(this.docType);
    return super.update(updatedDoc, meta);
  }

  override async updateMany(
    updatedDocs: Partial<TBaseType>[],
    meta?: DbOperationMetaData
  ): Promise<BulkWriteResult> {
    meta?.recordDocTypeTouched(this.docType);
    return super.updateMany(updatedDocs, meta);
  }

  override async delete(docId: UUID, meta?: DbOperationMetaData): Promise<DeleteResult> {
    meta?.recordDocTypeTouched(this.docType);
    return super.delete(docId, meta);
  }

  override async deleteList(docIds: UUID[], meta?: DbOperationMetaData): Promise<DeleteResult> {
    meta?.recordDocTypeTouched(this.docType);
    return super.deleteList(docIds, meta);
  }

  override async deleteAll(meta?: DbOperationMetaData): Promise<DeleteResult> {
    meta?.recordDocTypeTouched(this.docType);
    return super.deleteAll();
  }
}
