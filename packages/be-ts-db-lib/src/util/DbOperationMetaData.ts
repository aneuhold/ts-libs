import type { BaseDocument } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';

/**
 * Tracks metadata about database operations during a single API request.
 *
 * This is intentionally **not** called "context" to avoid confusion with other libraries that
 * use that term for different concepts.
 */
export default class DbOperationMetaData {
  private readonly docTypesTouched = new Set<string>();
  private readonly affectedUserIds = new Set<UUID>();
  private readonly docCache = new Map<UUID, unknown>();
  private readonly pendingDocsToCreate = new Map<UUID, BaseDocument>();

  /**
   * Records that a doc type was touched by an operation during this request.
   *
   * @param docType - The doc type that was touched.
   */
  recordDocTypeTouched(docType: string): void {
    this.docTypesTouched.add(docType);
  }

  /**
   * Records multiple user IDs as affected by an operation during this request.
   *
   * @param userIds - The user IDs to record as affected.
   */
  addAffectedUserIds(userIds: UUID[]): void {
    userIds.forEach((userId) => this.affectedUserIds.add(userId));
  }

  /**
   * Gets all doc types that were touched during this request.
   */
  getDocTypesTouched(): Set<string> {
    return this.docTypesTouched;
  }

  /**
   * Gets all user IDs recorded as affected during this request.
   */
  getAffectedUserIds(): Set<UUID> {
    return this.affectedUserIds;
  }

  /**
   * Caches a document by its ID to prevent duplicate queries during this request.
   *
   * @param docId - The ID of the document to cache.
   * @param doc - The document to cache.
   */
  cacheDoc<T>(docId: UUID, doc: T): void {
    this.docCache.set(docId, doc);
  }

  /**
   * Retrieves a cached document by its ID.
   *
   * @param docId - The ID of the document to retrieve.
   * @returns The cached document, or undefined if not found.
   */
  getCachedDoc<T>(docId: UUID): T | undefined {
    return this.docCache.get(docId) as T | undefined;
  }

  /**
   * Registers a document that will be created during this request.
   *
   * @param doc - The document to register.
   */
  registerPendingDoc<T extends BaseDocument>(doc: T): void {
    this.pendingDocsToCreate.set(doc._id, doc);
  }

  /**
   * Registers multiple documents that will be created during this request.
   *
   * @param docs - The documents to register.
   */
  registerPendingDocs<T extends BaseDocument>(docs: T[]): void {
    docs.forEach((doc) => {
      this.registerPendingDoc(doc);
    });
  }

  /**
   * Checks if a document with the given ID exists in pending docs.
   *
   * @param docId - The ID of the document to check.
   * @returns True if the document is pending creation, false otherwise.
   */
  hasPendingDoc(docId: UUID): boolean {
    return this.pendingDocsToCreate.has(docId);
  }
}
