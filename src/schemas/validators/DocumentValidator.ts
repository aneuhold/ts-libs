import BaseDocument from '../../documents/BaseDocument';

export type DocumentValidator<TDocType extends BaseDocument> = (
  doc: TDocType
) => { updatedDoc: TDocType; errors: string[] };
