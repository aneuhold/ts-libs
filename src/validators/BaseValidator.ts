import { BaseDocument, DocumentValidator } from '@aneuhold/core-ts-db-lib';
import { Logger } from '@aneuhold/core-ts-lib';
import { ObjectId } from 'bson';

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
   * This should only correct the records that this repository has a full
   * understanding of.
   *
   * This can be a long-running process, so it should only be executed in a
   * script.
   *
   * Make sure to use the {@link runStandardValidationForRepository} method
   * to run the validation to make things easier.
   */
  abstract validateRepositoryInDb(dryRun: boolean): Promise<void>;

  /**
   * Runs the standard validation for a repository.
   *
   * @param input
   * @param shouldDelete A function that returns true if the document should be
   * deleted. This should also log the specific error because it will not be
   * logged elsewhere.
   * @param input.dryRun
   * @param input.docName
   * @param input.allDocs
   * @param input.shouldDelete
   * @param input.documentValidator
   * @param input.deletionFunction
   * @param input.updateFunction
   */
  protected async runStandardValidationForRepository(input: {
    dryRun: boolean;
    docName: string;
    allDocs: Array<TBaseType>;
    shouldDelete: (doc: TBaseType) => boolean;
    documentValidator: DocumentValidator<TBaseType>;
    deletionFunction: (docIdsToDelete: ObjectId[]) => Promise<void>;
    updateFunction: (docsToUpdate: TBaseType[]) => Promise<void>;
  }) {
    const {
      dryRun,
      docName,
      allDocs,
      shouldDelete,
      documentValidator,
      deletionFunction,
      updateFunction
    } = input;
    const docIdsToDelete: Array<ObjectId> = [];
    const docsToValidate: Array<TBaseType> = [];
    const docsToUpdate: Array<TBaseType> = [];
    let numInvalidDocs = 0;

    // Check for docs that need to be deleted
    allDocs.forEach((doc) => {
      if (shouldDelete(doc)) {
        docIdsToDelete.push(doc._id);
      } else {
        docsToValidate.push(doc);
      }
    });
    // Validate the rest
    docsToValidate.forEach((doc) => {
      const { updatedDoc, errors } = documentValidator(doc);
      if (errors.length !== 0) {
        Logger.error(
          `${docName} with ID: ${doc._id.toString()} is invalid. Errors:`
        );
        numInvalidDocs += 1;
        errors.forEach((error) => {
          Logger.error(error);
        });
        docsToUpdate.push(updatedDoc);
      }
    });
    if (dryRun) {
      if (numInvalidDocs === 0) {
        Logger.success(`No invalid ${docName}s found.`);
      } else {
        Logger.info(
          `Would update ${numInvalidDocs} ${docName}s in the database.`
        );
      }
      if (docIdsToDelete.length === 0) {
        Logger.success(`No ${docName}s to delete found.`);
      } else {
        Logger.info(
          `Would delete ${docIdsToDelete.length} ${docName}s in the database.`
        );
      }
      return;
    }
    // Delete all invalid
    if (docIdsToDelete.length !== 0) {
      Logger.info(
        `Deleting ${docIdsToDelete.length} ${docName}s from the database.`
      );
      await deletionFunction(docIdsToDelete);
    } else {
      Logger.success(`No ${docName}s to delete found.`);
    }
    // Update all that need to be updated
    if (docsToUpdate.length !== 0) {
      Logger.info(
        `Updating ${docsToUpdate.length} ${docName}s in the database.`
      );
      await updateFunction(docsToUpdate);
    } else {
      Logger.success(`No ${docName}s to update found.`);
    }
  }

  /**
   * Checks that all elements that exist in array1, exist in array2.
   *
   * @param array1
   * @param array2
   */
  protected checkAllElementsExistInArr(
    array1: Array<unknown>,
    array2: Array<unknown>
  ): boolean {
    return array1.every((value) => array2.includes(value));
  }
}
