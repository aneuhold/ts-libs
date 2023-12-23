import { BaseDocument } from '@aneuhold/core-ts-db-lib';
import { Collection, DeleteResult, Filter, UpdateResult } from 'mongodb';
import { Document, ObjectId } from 'bson';
import DocumentDb from '../util/DocumentDb';
import IValidator from '../validators/BaseValidator';
import DocumentCleaner from '../util/DocumentCleaner';

/**
 * A base repository that implements a lot of the normal CRUD operations.
 */
export default abstract class BaseRepository<TBasetype extends BaseDocument> {
  protected collectionName: string;

  private collection?: Collection;

  /**
   * Constructs a new base repository.
   *
   * @param defaultUpdateCleaner this is a function that will be run on the
   * update object before it is sent to the DB. This is useful for removing
   * fields that should not be updated. Only remove fields that are at the
   * top-level of the object. _id is already removed.
   */
  constructor(
    collectionName: string,
    private validator: IValidator<TBasetype>,
    private defaultFilter?: Partial<TBasetype>,
    private defaultUpdateCleaner?: (
      doc: Partial<TBasetype>
    ) => Partial<TBasetype>
  ) {
    this.collectionName = collectionName;
  }

  protected async getCollection() {
    if (!this.collection) {
      this.collection = await DocumentDb.getCollection(this.collectionName);
    }
    return this.collection;
  }

  async insertNew(newDoc: TBasetype): Promise<TBasetype | null> {
    const collection = await this.getCollection();
    await this.validator.validateNewObject(newDoc);
    const insertResult = await collection.insertOne(newDoc);
    if (!insertResult.acknowledged) {
      return null;
    }
    return newDoc;
  }

  async get(filter: Partial<TBasetype>): Promise<TBasetype | null> {
    const collection = await this.getCollection();
    const result = await collection.findOne(this.getFilterWithDefault(filter));
    return result as TBasetype | null;
  }

  async getAll(): Promise<TBasetype[]> {
    const collection = await this.getCollection();
    const result = await collection.find(this.getFilterWithDefault()).toArray();
    // Set to unknown first because of some weird type things.
    return result as unknown as TBasetype[];
  }

  async getList(docIds: ObjectId[]): Promise<TBasetype[]> {
    const collection = await this.getCollection();
    const result = await collection
      .find(this.getFilterWithDefault({ _id: { $in: docIds } }))
      .toArray();
    return result as TBasetype[];
  }

  async delete(docId: ObjectId): Promise<DeleteResult> {
    const collection = await this.getCollection();
    return collection.deleteOne({ _id: docId });
  }

  async deleteList(docIds: ObjectId[]): Promise<DeleteResult> {
    const collection = await this.getCollection();
    return collection.deleteMany({ _id: { $in: docIds } });
  }

  /**
   * This should not be used except for testing purposes
   */
  async deleteAll(): Promise<DeleteResult> {
    const collection = await this.getCollection();
    return collection.deleteMany(this.getFilterWithDefault());
  }

  /**
   * Updates the provided doc in the DB.
   *
   * This base method strips the `_id` before updating.
   */
  async update(updatedDoc: Partial<TBasetype>): Promise<UpdateResult> {
    const collection = await this.getCollection();
    await this.validator.validateUpdateObject(updatedDoc);

    const docId = updatedDoc._id;

    const cleanedDoc = this.cleanUpdateObject(updatedDoc);

    return collection.updateOne({ _id: docId }, { $set: cleanedDoc });
  }

  /**
   * Gets the filter with the default filter applied if there is one.
   *
   * This is purposefully changing the type because of some weird restrictions
   * with the `mongodb` package types.
   */
  private getFilterWithDefault(
    filter: Filter<Document> = {}
  ): Filter<Document> {
    if (!this.defaultFilter) {
      return filter;
    }
    return { ...filter, ...this.defaultFilter };
  }

  /**
   * Cleans the update object by removing the `_id` field and running the
   * default update cleaner if there is one.
   *
   * Returns a shallow copy of the object.
   */
  private cleanUpdateObject(
    updatedDoc: Partial<TBasetype>
  ): Partial<TBasetype> {
    return this.defaultUpdateCleaner
      ? this.defaultUpdateCleaner(DocumentCleaner.id(updatedDoc))
      : DocumentCleaner.id(updatedDoc);
  }
}
