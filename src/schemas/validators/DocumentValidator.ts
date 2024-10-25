import BaseDocument from '../../documents/BaseDocument.js';

export type DocumentValidator<TDocType extends BaseDocument> = (
  doc: TDocType
) => { updatedDoc: TDocType; errors: string[] };
