import type { BaseDocumentWithType, RequiredUserId } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { Filter } from 'mongodb';
import CleanDocument from '../../util/DocumentCleaner.js';
import type IValidator from '../../validators/BaseValidator.js';
import DashboardBaseRepository from './DashboardBaseRepository.js';

/**
 * A base repository for the `dashboard` collection that requires a `userId`.
 */
export default abstract class DashboardBaseWithUserIdRepository<
  TBaseType extends BaseDocumentWithType & RequiredUserId
> extends DashboardBaseRepository<TBaseType> {
  constructor(
    docType: string,
    validator: IValidator<TBaseType>,
    updateCleaner?: (doc: Partial<TBaseType>) => Partial<TBaseType>
  ) {
    const defaultUpdateCleaner = (doc: Partial<TBaseType>) =>
      updateCleaner ? updateCleaner(CleanDocument.userId(doc)) : CleanDocument.userId(doc);
    super(docType, validator, defaultUpdateCleaner);
  }

  /**
   * Gets all items for a given user.
   *
   * @param userId The ID of the user to get items for.
   */
  async getAllForUser(userId: UUID): Promise<TBaseType[]> {
    const collection = await this.getCollection();
    const filter = {
      $and: [this.getFilterWithDefault(), { userId }]
    } as Filter<TBaseType>;
    const result = await collection.find(filter).toArray();
    return result as TBaseType[];
  }
}
