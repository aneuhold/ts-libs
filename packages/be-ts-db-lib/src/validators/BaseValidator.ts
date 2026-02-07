import type { BaseDocument } from '@aneuhold/core-ts-db-lib';
import { DR } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import type { ZodType } from 'zod';
import type DbOperationMetaData from '../util/DbOperationMetaData.js';

export enum ObjectSchemaState {
  Valid,
  InvalidAndCorrectable,
  InvalidAndUncorrectable
}

/**
 * Base validator class for document validation.
 * Handles both Zod schema validation and business logic validation.
 */
export default abstract class IValidator<TBaseType extends BaseDocument> {
  /**
   * Constructs a new validator.
   *
   * @param schema - The Zod schema for the document type.
   * @param partialSchema - The Zod schema for partial document updates.
   */
  constructor(
    protected schema: ZodType<TBaseType>,
    protected partialSchema: ZodType<Partial<TBaseType>>
  ) {}

  /**
   * Validates that an object that is supposed to be inserted in to the database
   * is correct. This includes both schema validation and business logic validation.
   *
   * @param object - The object to validate.
   * @param meta - Optional metadata about the current operation, including pending documents.
   */
  async validateNewObject(object: TBaseType, meta?: DbOperationMetaData): Promise<void> {
    // First validate schema with Zod
    const parseResult = this.schema.safeParse(object);
    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new Error(`Schema validation failed: ${errorMessage}`);
    }
    // Then run business logic validation
    await this.validateNewObjectBusinessLogic(object, meta);
  }

  /**
   * Business logic validation for new objects.
   * Override this method to add custom validation logic.
   *
   * @param object - The object to validate.
   * @param meta - Optional metadata about the current operation, including pending documents.
   */
  protected abstract validateNewObjectBusinessLogic(
    object: TBaseType,
    meta?: DbOperationMetaData
  ): Promise<void>;

  /**
   * Validates an object that is supposed to be updated in the database.
   * This includes both schema validation and business logic validation.
   *
   * At this point, the fields that do not change should already be stripped.
   *
   * @param partialObject - The partial object to validate.
   * @param meta - Optional metadata about the current operation, including pending documents.
   */
  async validateUpdateObject(
    partialObject: Partial<TBaseType>,
    meta?: DbOperationMetaData
  ): Promise<void> {
    // First validate schema with Zod using partial schema
    const parseResult = this.partialSchema.safeParse(partialObject);
    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new Error(`Schema validation failed: ${errorMessage}`);
    }
    // Then run business logic validation
    await this.validateUpdateObjectBusinessLogic(partialObject, meta);
  }

  /**
   * Business logic validation for update objects.
   * Override this method to add custom validation logic.
   *
   * @param partialObject - The partial object to validate.
   * @param meta - Optional metadata about the current operation, including pending documents.
   */
  protected abstract validateUpdateObjectBusinessLogic(
    partialObject: Partial<TBaseType>,
    meta?: DbOperationMetaData
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
   * @param input - The validation configuration.
   * @param input.dryRun - Whether to run in dry-run mode.
   * @param input.docName - The name of the document type.
   * @param input.allDocs - All documents to validate.
   * @param input.shouldDelete - A function that returns true if the document should be deleted. This should also log the specific error because it will not be logged elsewhere.
   * @param input.additionalValidation - Optional additional validation logic beyond schema validation.
   * @param input.deletionFunction - Function to delete documents.
   * @param input.updateFunction - Function to update documents.
   */
  protected async runStandardValidationForRepository(input: {
    dryRun: boolean;
    docName: string;
    allDocs: Array<TBaseType>;
    shouldDelete: (doc: TBaseType) => boolean;
    additionalValidation?: (doc: TBaseType) => { updatedDoc: TBaseType; errors: string[] };
    deletionFunction: (docIdsToDelete: UUID[]) => Promise<void>;
    updateFunction: (docsToUpdate: TBaseType[]) => Promise<void>;
  }) {
    const {
      dryRun,
      docName,
      allDocs,
      shouldDelete,
      additionalValidation,
      deletionFunction,
      updateFunction
    } = input;
    const docIdsToDelete: Array<UUID> = [];
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
      const errors: string[] = [];
      let updatedDoc = doc;

      // First validate with Zod schema
      const parseResult = this.schema.safeParse(doc);
      if (!parseResult.success) {
        errors.push(...parseResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`));
      } else {
        updatedDoc = parseResult.data;
      }

      // Then run additional validation if provided
      if (additionalValidation) {
        const additionalResult = additionalValidation(doc);
        errors.push(...additionalResult.errors);
        if (additionalResult.updatedDoc !== doc) {
          updatedDoc = additionalResult.updatedDoc;
        }
      }

      if (errors.length !== 0) {
        DR.logger.error(`${docName} with ID: ${doc._id} is invalid. Errors:`);
        numInvalidDocs += 1;
        errors.forEach((error) => {
          DR.logger.error(`  ${error}`);
        });
        docsToUpdate.push(updatedDoc);
      }
    });
    if (dryRun) {
      if (numInvalidDocs === 0) {
        DR.logger.success(`No invalid ${docName}s found.`);
      } else {
        DR.logger.info(`Would update ${numInvalidDocs} ${docName}s in the database.`);
      }
      if (docIdsToDelete.length === 0) {
        DR.logger.success(`No ${docName}s to delete found.`);
      } else {
        DR.logger.info(`Would delete ${docIdsToDelete.length} ${docName}s in the database.`);
      }
      return;
    }
    // Delete all invalid
    if (docIdsToDelete.length !== 0) {
      DR.logger.info(`Deleting ${docIdsToDelete.length} ${docName}s from the database.`);
      await deletionFunction(docIdsToDelete);
    } else {
      DR.logger.success(`No ${docName}s to delete found.`);
    }
    // Update all that need to be updated
    if (docsToUpdate.length !== 0) {
      DR.logger.info(`Updating ${docsToUpdate.length} ${docName}s in the database.`);
      await updateFunction(docsToUpdate);
    } else {
      DR.logger.success(`No ${docName}s to update found.`);
    }
  }

  /**
   * Checks that all elements that exist in array1, exist in array2.
   *
   * @param array1 - The first array.
   * @param array2 - The second array.
   */
  protected checkAllElementsExistInArr(array1: Array<unknown>, array2: Array<unknown>): boolean {
    return array1.every((value) => array2.includes(value));
  }
}
