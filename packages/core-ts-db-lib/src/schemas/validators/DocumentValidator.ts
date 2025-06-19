import BaseDocument from '../../documents/BaseDocument.js';

/**
 * A validator for a document.
 */
export type DocumentValidator<TDocType extends BaseDocument> = (doc: TDocType) => {
  updatedDoc: TDocType;
  errors: string[];
};
