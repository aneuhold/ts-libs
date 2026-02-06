import type {
  BaseDocumentWithType,
  BaseDocumentWithUpdatedAndCreatedDates
} from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { BulkWriteResult, DeleteResult, UpdateResult } from 'mongodb';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import CleanDocument from '../../util/DocumentCleaner.js';
import type IValidator from '../../validators/BaseValidator.js';
import BaseRepository from '../BaseRepository.js';

/**
 * A base repository for the `workout` collection.
 */
export default abstract class WorkoutBaseRepository<
  TBaseType extends BaseDocumentWithType & BaseDocumentWithUpdatedAndCreatedDates
> extends BaseRepository<TBaseType> {
  private static COLLECTION_NAME = 'workout';

  constructor(
    protected docType: string,
    validator: IValidator<TBaseType>,
    updateCleaner?: (doc: Partial<TBaseType>) => Partial<TBaseType>
  ) {
    const defaultUpdateCleaner = (doc: Partial<TBaseType>) => {
      updateCleaner?.(doc);
      CleanDocument.docType(doc);
      CleanDocument.createdDate(doc);
      return doc;
    };
    const defaultFilter = { docType } as Partial<TBaseType>;
    super(WorkoutBaseRepository.COLLECTION_NAME, validator, defaultFilter, defaultUpdateCleaner);
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
    updatedDoc.lastUpdatedDate = new Date();
    return super.update(updatedDoc, meta);
  }

  override async updateMany(
    updatedDocs: Partial<TBaseType>[],
    meta?: DbOperationMetaData
  ): Promise<BulkWriteResult> {
    meta?.recordDocTypeTouched(this.docType);
    updatedDocs.forEach((doc) => {
      doc.lastUpdatedDate = new Date();
    });
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
