import { BaseDocumentWithType } from '@aneuhold/core-ts-db-lib';
import CleanDocument from '../../util/DocumentCleaner.js';
import IValidator from '../../validators/BaseValidator.js';
import BaseRepository from '../BaseRepository.js';

/**
 * A base repository for the `dashboard` collection.
 */
export default abstract class DashboardBaseRepository<
  TBaseType extends BaseDocumentWithType
> extends BaseRepository<TBaseType> {
  private static COLLECTION_NAME = 'dashboard';

  constructor(
    docType: string,
    validator: IValidator<TBaseType>,
    updateCleaner?: (doc: Partial<TBaseType>) => Partial<TBaseType>
  ) {
    const defaultUpdateCleaner = (updatedDoc: Partial<TBaseType>) =>
      updateCleaner
        ? updateCleaner(CleanDocument.docType(updatedDoc))
        : CleanDocument.docType(updatedDoc);
    const defaultFilter = { docType } as Partial<TBaseType>;
    super(
      DashboardBaseRepository.COLLECTION_NAME,
      validator,
      defaultFilter,
      defaultUpdateCleaner
    );
  }
}
