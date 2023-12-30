import { BaseDocument } from '@aneuhold/core-ts-db-lib';

export enum ObjectSchemaState {
  Valid,
  InvalidAndCorrectable,
  InvalidAndUncorrectable
}

export default abstract class IValidator<TBaseType extends BaseDocument> {
  /**
   * Validates that an object that is supposed to be inserted in to the database
   * is correct.
   */
  abstract validateNewObject(object: TBaseType): Promise<void>;

  /**
   * Validates an object that is suppposed to be updated in the database.
   *
   * At this point, the fields that do not change should already be stripped.
   */
  abstract validateUpdateObject(
    partialObject: Partial<TBaseType>
  ): Promise<void>;

  /**
   * Validates the entire DB for the repository, and corrects where needed.
   *
   * This should only correct the records that this repository has full
   * understanding of.
   *
   * This can be a long-running process, so it should only be executed in a
   * script.
   */
  abstract validateRepositoryInDb(dryRun: boolean): Promise<void>;

  /**
   * Checks that all elements that exist in array1, exist in array2.
   */
  protected checkAllElementsExistInArr(
    array1: Array<unknown>,
    array2: Array<unknown>
  ) {
    return array1.every((value) => array2.includes(value));
  }
}
