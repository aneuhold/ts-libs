import { BaseDocument, BaseDocumentWithType, RequiredUserId } from '@aneuhold/core-ts-db-lib';

/**
 * A class which contains some standard methods for cleaning update documents
 * before they are sent to the database.
 */
export default class CleanDocument {
  static id<TDocType extends BaseDocument>(updateDoc: Partial<TDocType>) {
    const docCopy = { ...updateDoc };
    delete docCopy._id;
    return docCopy;
  }

  static userId<TDocType extends RequiredUserId>(updateDoc: Partial<TDocType>) {
    const docCopy = { ...updateDoc };
    delete docCopy.userId;
    return docCopy;
  }

  static docType<TDocType extends BaseDocumentWithType>(updateDoc: Partial<TDocType>) {
    const docCopy = { ...updateDoc };
    delete docCopy.docType;
    return docCopy;
  }
}
