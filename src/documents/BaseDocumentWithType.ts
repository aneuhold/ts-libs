import BaseDocument from './BaseDocument.js';

export default abstract class BaseDocumentWithType extends BaseDocument {
  abstract docType: string;
}
