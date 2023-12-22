import BaseDocument from './BaseDocument';

export default abstract class BaseDocumentWithType extends BaseDocument {
  abstract docType: string;
}
