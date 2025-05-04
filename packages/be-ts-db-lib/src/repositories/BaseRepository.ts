import { BaseDocument } from '@aneuhold/core-ts-db-lib';
import { Document, ObjectId } from 'bson';
import {
  AnyBulkWriteOperation,
  BulkWriteResult,
  Collection,
  DeleteResult,
  Filter,
  OptionalUnlessRequiredId,
  UpdateResult
} from 'mongodb';
import RepoSubscriptionService, {
  RepoListeners,
  RepoSubscribers
} from '../services/RepoSubscriptionService.js';
import DocumentCleaner from '../util/DocumentCleaner.js';
import DocumentDb from '../util/DocumentDb.js';
import IValidator from '../validators/BaseValidator.js';

/**
 * Base repository class for handling common database operations.
 *
 * @template TBasetype - The type of the documents in the collection.
 */
export default abstract class BaseRepository<TBasetype extends BaseDocument> {
  protected collectionName: string;

  private collection?: Collection<TBasetype>;

  protected subscribers: RepoSubscribers<TBasetype> =
    RepoSubscriptionService.getDefaultSubscribers<TBasetype>();

  /**
   * Constructs a new base repository.
   *
   * @param collectionName - The name of the collection.
   * @param validator - The validator for the document type.
   * @param defaultFilter - The default filter to apply to queries.
   * @param defaultUpdateCleaner - A function to clean update objects before sending to the DB.
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

  /**
   * Gets the collection, initializing it if necessary.
   *
   * @returns The collection.
   */
  protected async getCollection(): Promise<Collection<TBasetype>> {
    if (!this.collection) {
      this.collection = await DocumentDb.getCollection(this.collectionName);
      this.setupSubscribers();
    }
    return this.collection;
  }

  protected abstract setupSubscribers(): void;

  /**
   * Registers a set of functions that will be called when a change happens
   * in this repository.
   *
   * @param listeners - The listeners to register.
   */
  subscribeToChanges(listeners: RepoListeners<TBasetype>) {
    const { insertNew, updateOne, updateMany, deleteOne, deleteList } =
      listeners;
    if (insertNew) {
      this.subscribers.insertNew.push(insertNew);
    }
    if (updateOne) {
      this.subscribers.updateOne.push(updateOne);
    }
    if (updateMany) {
      this.subscribers.updateMany.push(updateMany);
    }
    if (deleteOne) {
      this.subscribers.deleteOne.push(deleteOne);
    }
    if (deleteList) {
      this.subscribers.deleteList.push(deleteList);
    }
  }

  /**
   * Inserts a new document into the collection.
   *
   * @param newDoc - The new document to insert.
   * @returns The inserted document or null if the insertion failed.
   */
  async insertNew(newDoc: TBasetype): Promise<TBasetype | null> {
    const collection = await this.getCollection();
    await this.validator.validateNewObject(newDoc);
    const insertResult = await collection.insertOne(
      newDoc as OptionalUnlessRequiredId<TBasetype>
    );
    if (!insertResult.acknowledged) {
      return null;
    }
    await Promise.all(
      this.subscribers.insertNew.map((subscriber) => subscriber(newDoc))
    );
    return newDoc;
  }

  /**
   * Inserts multiple new documents into the collection.
   *
   * @param newDocs - The new documents to insert.
   * @returns The inserted documents or an empty array if the insertion failed.
   */
  async insertMany(newDocs: TBasetype[]): Promise<TBasetype[]> {
    const collection = await this.getCollection();
    await Promise.all(
      newDocs.map((doc) => this.validator.validateNewObject(doc))
    );
    const insertResult = await collection.insertMany(
      newDocs as OptionalUnlessRequiredId<TBasetype>[]
    );
    if (!insertResult.acknowledged) {
      return [];
    }
    await Promise.all(
      this.subscribers.insertMany.map((subscriber) => subscriber(newDocs))
    );
    return newDocs;
  }

  /**
   * Retrieves a document matching the given filter.
   *
   * @param filter - The filter to apply.
   * @returns The matching document or null if no document was found.
   */
  async get(filter: Partial<TBasetype>): Promise<TBasetype | null> {
    const collection = await this.getCollection();
    const result = await collection.findOne(this.getFilterWithDefault(filter));
    return result as TBasetype | null;
  }

  /**
   * Retrieves all documents in the collection.
   *
   * @returns An array of all documents in the collection.
   */
  async getAll(): Promise<TBasetype[]> {
    const collection = await this.getCollection();
    const result = await collection.find(this.getFilterWithDefault()).toArray();
    // Set to unknown first because of some weird type things.
    return result as unknown as TBasetype[];
  }

  /**
   * Gets all the IDs in the collection as a hash for performant lookups.
   *
   * @returns An object where the keys are document IDs and the values are true.
   */
  async getAllIdsAsHash(): Promise<{ [id: string]: boolean }> {
    const allDocs = await this.getAll();
    return allDocs.reduce<{ [id: string]: boolean }>((acc, doc) => {
      acc[doc._id.toString()] = true;
      return acc;
    }, {});
  }

  /**
   * Retrieves a list of documents matching the given IDs.
   *
   * @param docIds - The IDs of the documents to retrieve.
   * @returns An array of matching documents.
   */
  async getList(docIds: ObjectId[]): Promise<TBasetype[]> {
    const collection = await this.getCollection();
    const result = await collection
      .find(this.getFilterWithDefault({ _id: { $in: docIds } }))
      .toArray();
    return result as TBasetype[];
  }

  /**
   * Deletes a document by its ID.
   *
   * @param docId - The ID of the document to delete.
   * @returns The result of the delete operation.
   */
  async delete(docId: ObjectId): Promise<DeleteResult> {
    const collection = await this.getCollection();
    await Promise.all(
      this.subscribers.deleteOne.map((subscriber) => subscriber(docId))
    );
    return collection.deleteOne({ _id: docId } as Filter<TBasetype>);
  }

  /**
   * Deletes multiple documents by their IDs.
   *
   * @param docIds - The IDs of the documents to delete.
   * @returns The result of the delete operation.
   */
  async deleteList(docIds: ObjectId[]): Promise<DeleteResult> {
    const collection = await this.getCollection();
    const deleteResult = collection.deleteMany({
      _id: { $in: docIds }
    } as Filter<TBasetype>);
    await Promise.all(
      this.subscribers.deleteList.map((subscriber) => subscriber(docIds))
    );
    return deleteResult;
  }

  /**
   * This should not be used except for testing purposes
   *
   * @returns The result of the delete operation.
   */
  async deleteAll(): Promise<DeleteResult> {
    const collection = await this.getCollection();
    return collection.deleteMany(this.getFilterWithDefault());
  }

  /**
   * Updates the provided document in the DB.
   *
   * This base method strips the `_id` before updating.
   *
   * @param updatedDoc - The document to update.
   * @returns The result of the update operation.
   */
  async update(updatedDoc: Partial<TBasetype>): Promise<UpdateResult> {
    const collection = await this.getCollection();
    await this.validator.validateUpdateObject(updatedDoc);

    const docId = updatedDoc._id;

    const cleanedDoc = this.cleanUpdateObject(updatedDoc);

    const result = collection.updateOne({ _id: docId } as Filter<TBasetype>, {
      $set: cleanedDoc
    });
    await Promise.all(
      this.subscribers.updateOne.map((subscriber) => subscriber(updatedDoc))
    );
    return result;
  }

  /**
   * Updates the provided documents in the DB.
   *
   * This base method strips the `_id` before updating.
   *
   * @param updatedDocs - The documents to update.
   * @returns The result of the bulk update operation.
   */
  async updateMany(
    updatedDocs: Array<Partial<TBasetype>>
  ): Promise<BulkWriteResult> {
    const collection = await this.getCollection();
    await Promise.all(
      updatedDocs.map((doc) => this.validator.validateUpdateObject(doc))
    );

    const bulkOps = updatedDocs.map((doc) => {
      const docId = doc._id;
      const cleanedDoc = this.cleanUpdateObject(doc);
      return {
        updateOne: {
          filter: { _id: docId },
          update: { $set: cleanedDoc }
        }
      };
    }) as AnyBulkWriteOperation<TBasetype>[];

    await Promise.all(
      this.subscribers.updateMany.map((subscriber) => subscriber(updatedDocs))
    );

    return collection.bulkWrite(bulkOps);
  }

  /**
   * Gets the filter with the default filter applied if there is one.
   *
   * This is purposefully changing the type because of some weird restrictions
   * with the `mongodb` package types.
   *
   * @param filter - The filter to apply.
   * @returns The filter with the default filter applied.
   */
  protected getFilterWithDefault(
    filter: Filter<Document> = {}
  ): Filter<Document> {
    if (!this.defaultFilter) {
      return filter;
    }
    return { ...filter, ...this.defaultFilter };
  }

  /**
   * Checks if two arrays of {@link ObjectId} are equal.
   *
   * @param array1 - The first array.
   * @param array2 - The second array.
   * @returns True if the arrays are equal, false otherwise.
   */
  protected objectIdArraysAreEqual(
    array1: ObjectId[],
    array2: ObjectId[]
  ): boolean {
    if (array1.length !== array2.length) {
      return false;
    }
    return array1.every((id) => array2.includes(id));
  }

  /**
   * Cleans the update object by removing the `_id` field and running the
   * default update cleaner if there is one.
   *
   * Returns a shallow copy of the object.
   *
   * @param updatedDoc - The document to clean.
   * @returns The cleaned document.
   */
  private cleanUpdateObject(
    updatedDoc: Partial<TBasetype>
  ): Partial<TBasetype> {
    return this.defaultUpdateCleaner
      ? this.defaultUpdateCleaner(DocumentCleaner.id(updatedDoc))
      : DocumentCleaner.id(updatedDoc);
  }
}
