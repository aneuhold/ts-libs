import type { UUID } from 'crypto';
import DocumentService from '../services/DocumentService.js';

/**
 * Base class for all document types stored in a document database.
 *
 * Provides the common `_id` field required by MongoDB and other
 * document databases. All document types should extend this class.
 */
export default abstract class BaseDocument {
  /** The unique identifier for this document */
  _id: UUID = DocumentService.generateID();
}
