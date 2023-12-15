import { BaseDocument } from '@aneuhold/core-ts-db-lib';
import { Collection, DeleteResult, UpdateResult } from 'mongodb';
import { ObjectId } from 'bson';
import DocumentDb from '../util/DocumentDb';
import IValidator from '../validators/BaseValidator';

/**
 * A base repository that implements a lot of the normal CRUD operations.
 */
export default abstract class BaseRepository<TBasetype extends BaseDocument> {
  protected collectionName: string;

  private collection?: Collection;

  constructor(
    collectionName: string,
    private validator: IValidator<TBasetype>
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
    const result = await collection.findOne(filter);
    return result as TBasetype | null;
  }

  async getAll(): Promise<TBasetype[]> {
    const collection = await this.getCollection();
    const result = await collection.find().toArray();
    // Set to unknown first because of some weird type things.
    return result as unknown as TBasetype[];
  }

  async getList(docIds: ObjectId[]): Promise<TBasetype[]> {
    const collection = await this.getCollection();
    const result = await collection.find({ _id: { $in: docIds } }).toArray();
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
    return collection.deleteMany({});
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

    // Create a copy so that there aren't side-effects
    const docCopy = { ...updatedDoc };
    delete docCopy._id;

    return collection.updateOne({ _id: docId }, { $set: docCopy });
  }
}
