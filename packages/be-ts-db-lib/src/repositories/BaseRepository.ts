import type { BaseDocument } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type {
  AnyBulkWriteOperation,
  BulkWriteResult,
  Collection,
  DeleteResult,
  Filter,
  OptionalUnlessRequiredId,
  UpdateResult
} from 'mongodb';
import type { RepoListeners, RepoSubscribers } from '../services/RepoSubscriptionService.js';
import RepoSubscriptionService from '../services/RepoSubscriptionService.js';
import type DbOperationMetaData from '../util/DbOperationMetaData.js';
import DocumentCleaner from '../util/DocumentCleaner.js';
import DocumentDb from '../util/DocumentDb.js';
import type IValidator from '../validators/BaseValidator.js';

/**
 * Base repository class for handling common database operations.
 *
 * Implementation note: I have tried to do the types correctly here, but kept struggling with
 * MongoDB's types around Filter<T> and _id fields.
 *
 * @template TBaseType - The type of the documents in the collection.
 */
export default abstract class BaseRepository<TBaseType extends BaseDocument> {
  protected collectionName: string;

  private collection?: Collection<TBaseType>;

  protected subscribers: RepoSubscribers<TBaseType> =
    RepoSubscriptionService.getDefaultSubscribers<TBaseType>();

  /**
   * Constructs a new base repository.
   *
   * @param collectionName - The name of the collection.
   * @param validator - The validator for the document type (handles both schema and business logic validation).
   * @param defaultFilter - The default filter to apply to queries.
   * @param defaultUpdateCleaner - A function to clean update objects before sending to the DB.
   */
  constructor(
    collectionName: string,
    private validator: IValidator<TBaseType>,
    private defaultFilter?: Partial<TBaseType>,
    private defaultUpdateCleaner?: (doc: Partial<TBaseType>) => Partial<TBaseType>
  ) {
    this.collectionName = collectionName;
  }

  /**
   * Gets the collection, initializing it if necessary.
   *
   * @returns The collection.
   */
  protected async getCollection(): Promise<Collection<TBaseType>> {
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
  subscribeToChanges(listeners: RepoListeners<TBaseType>) {
    const { insertNew, updateOne, updateMany, deleteOne, deleteList } = listeners;
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
   * @param meta - Tracks database operation metadata for a single request.
   * @returns The inserted document or null if the insertion failed.
   */
  async insertNew(newDoc: TBaseType, meta?: DbOperationMetaData): Promise<TBaseType | null> {
    const collection = await this.getCollection();
    await this.validator.validateNewObject(newDoc, meta);
    const insertResult = await collection.insertOne(newDoc as OptionalUnlessRequiredId<TBaseType>);
    if (!insertResult.acknowledged) {
      return null;
    }
    await Promise.all(this.subscribers.insertNew.map((subscriber) => subscriber(newDoc, meta)));
    return newDoc;
  }

  /**
   * Inserts multiple new documents into the collection.
   *
   * @param newDocs - The new documents to insert.
   * @param meta - Tracks database operation metadata for a single request.
   * @returns The inserted documents or an empty array if the insertion failed.
   */
  async insertMany(newDocs: TBaseType[], meta?: DbOperationMetaData): Promise<TBaseType[]> {
    const collection = await this.getCollection();
    await Promise.all(newDocs.map((doc) => this.validator.validateNewObject(doc, meta)));
    const insertResult = await collection.insertMany(
      newDocs as OptionalUnlessRequiredId<TBaseType>[]
    );
    if (!insertResult.acknowledged) {
      return [];
    }
    await Promise.all(this.subscribers.insertMany.map((subscriber) => subscriber(newDocs, meta)));
    return newDocs;
  }

  /**
   * Retrieves a document matching the given filter.
   *
   * @param filter - The filter to apply.
   * @returns The matching document or null if no document was found.
   */
  async get(filter: Partial<TBaseType>): Promise<TBaseType | null> {
    const collection = await this.getCollection();
    const result = await collection.findOne(this.getFilterWithDefault(filter as Filter<TBaseType>));
    return result as TBaseType | null;
  }

  /**
   * Retrieves all documents in the collection.
   *
   * @returns An array of all documents in the collection.
   */
  async getAll(): Promise<TBaseType[]> {
    const collection = await this.getCollection();
    const result = await collection.find(this.getFilterWithDefault()).toArray();
    // Set to unknown first because of some weird type things.
    return result as unknown as TBaseType[];
  }

  /**
   * Gets all the IDs in the collection as a hash for performant lookups.
   *
   * @returns An object where the keys are document IDs and the values are true.
   */
  async getAllIdsAsHash(): Promise<{ [id: UUID]: boolean }> {
    const allDocs = await this.getAll();
    return allDocs.reduce<{ [id: UUID]: boolean }>((acc, doc) => {
      acc[doc._id] = true;
      return acc;
    }, {});
  }

  /**
   * Retrieves a list of documents matching the given IDs.
   *
   * @param docIds - The IDs of the documents to retrieve.
   * @returns An array of matching documents.
   */
  async getList(docIds: UUID[]): Promise<TBaseType[]> {
    const collection = await this.getCollection();
    const result = await collection
      .find(this.getFilterWithDefault({ _id: { $in: docIds } } as Filter<TBaseType>))
      .toArray();
    return result as TBaseType[];
  }

  /**
   * Gets a list of documents matching the given filter. This will and it together with the
   * default filter.
   *
   * @param filter - The filter to apply.
   */
  async getListWithFilter(filter: Filter<TBaseType>): Promise<TBaseType[]> {
    const collection = await this.getCollection();
    const result = await collection.find(this.getFilterWithDefault(filter)).toArray();
    return result as TBaseType[];
  }

  /**
   * Deletes a document by its ID.
   *
   * @param docId - The ID of the document to delete.
   * @param meta - Tracks database operation metadata for a single request.
   * @returns The result of the delete operation.
   */
  async delete(docId: UUID, meta?: DbOperationMetaData): Promise<DeleteResult> {
    const collection = await this.getCollection();
    await Promise.all(this.subscribers.deleteOne.map((subscriber) => subscriber(docId, meta)));
    return collection.deleteOne({ _id: docId } as Filter<TBaseType>);
  }

  /**
   * Deletes multiple documents by their IDs.
   *
   * @param docIds - The IDs of the documents to delete.
   * @param meta - Tracks database operation metadata for a single request.
   * @returns The result of the delete operation.
   */
  async deleteList(docIds: UUID[], meta?: DbOperationMetaData): Promise<DeleteResult> {
    const collection = await this.getCollection();
    const deleteResult = collection.deleteMany({
      _id: { $in: docIds }
    } as Filter<TBaseType>);
    await Promise.all(this.subscribers.deleteList.map((subscriber) => subscriber(docIds, meta)));
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
   * @param meta - Tracks database operation metadata for a single request.
   * @returns The result of the update operation.
   */
  async update(updatedDoc: Partial<TBaseType>, meta?: DbOperationMetaData): Promise<UpdateResult> {
    const collection = await this.getCollection();
    await this.validator.validateUpdateObject(updatedDoc, meta);

    const docId = updatedDoc._id;

    const cleanedDoc = this.cleanUpdateObject(updatedDoc);

    const result = collection.updateOne({ _id: docId } as Filter<TBaseType>, {
      $set: cleanedDoc
    });
    await Promise.all(this.subscribers.updateOne.map((subscriber) => subscriber(updatedDoc, meta)));
    return result;
  }

  /**
   * Updates the provided documents in the DB.
   *
   * This base method strips the `_id` before updating.
   *
   * @param updatedDocs - The documents to update.
   * @param meta - Tracks database operation metadata for a single request.
   * @returns The result of the bulk update operation.
   */
  async updateMany(
    updatedDocs: Array<Partial<TBaseType>>,
    meta?: DbOperationMetaData
  ): Promise<BulkWriteResult> {
    const collection = await this.getCollection();
    await Promise.all(updatedDocs.map((doc) => this.validator.validateUpdateObject(doc, meta)));

    const bulkOps = updatedDocs.map((doc) => {
      const docId = doc._id;
      const cleanedDoc = this.cleanUpdateObject(doc);
      return {
        updateOne: {
          filter: { _id: docId },
          update: { $set: cleanedDoc }
        }
      };
    }) as AnyBulkWriteOperation<TBaseType>[];

    await Promise.all(
      this.subscribers.updateMany.map((subscriber) => subscriber(updatedDocs, meta))
    );

    return collection.bulkWrite(bulkOps);
  }

  /**
   * Fetches and caches multiple documents, returning only those not already cached.
   * This method checks the cache in the provided metadata object first, then fetches
   * any missing documents from the database and caches them.
   *
   * @param docIds - The IDs of the documents to fetch.
   * @param meta - The metadata object containing the cache.
   * @returns An array of all documents (from cache and newly fetched).
   */
  protected async fetchAndCacheDocsForMeta(
    docIds: UUID[],
    meta: DbOperationMetaData
  ): Promise<TBaseType[]> {
    const docIdsToFetch: UUID[] = [];
    const cachedDocs: TBaseType[] = [];

    // Check cache first
    for (const docId of docIds) {
      const cached = meta.getCachedDoc<TBaseType>(docId);
      if (cached) {
        cachedDocs.push(cached);
      } else {
        docIdsToFetch.push(docId);
      }
    }

    // Fetch uncached docs
    if (docIdsToFetch.length > 0) {
      const fetchedDocs = await this.getList(docIdsToFetch);
      fetchedDocs.forEach((doc) => {
        meta.cacheDoc(doc._id, doc);
        cachedDocs.push(doc);
      });
    }

    return cachedDocs;
  }

  /**
   * Gets the filter with the default filter applied if there is one. This will "and" them together.
   *
   * @param filter - The filter to apply.
   * @returns The filter with the default filter applied.
   */
  protected getFilterWithDefault(filter: Filter<TBaseType> = {}): Filter<TBaseType> {
    if (!this.defaultFilter) {
      return filter;
    }
    // Two merged filters is the same as using `$and`
    return { ...filter, ...this.defaultFilter };
  }

  /**
   * Checks if two arrays of {@link UUID} are equal.
   *
   * @param array1 - The first array.
   * @param array2 - The second array.
   * @returns True if the arrays are equal, false otherwise.
   */
  protected uuidArraysAreEqual(array1: UUID[], array2: UUID[]): boolean {
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
  private cleanUpdateObject(updatedDoc: Partial<TBaseType>): Partial<TBaseType> {
    return this.defaultUpdateCleaner
      ? this.defaultUpdateCleaner(DocumentCleaner.id(updatedDoc))
      : DocumentCleaner.id(updatedDoc);
  }
}
