import BaseDocument from './BaseDocument.js';

/**
 * Base document with a `docType` property.
 */
export default abstract class BaseDocumentWithType extends BaseDocument {
  abstract docType: string;
}
