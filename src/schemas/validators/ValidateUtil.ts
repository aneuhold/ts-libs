import {
  isOptionalArray,
  isOptionalBoolean,
  isOptionalNumber,
  isOptionalObject,
  isOptionalString
} from '../type-guards/commonTypeGuards.js';

type IndexableObject = { [keyName: string]: unknown };

/**
 * All the validators in this class will modify the parent object to the
 * default value if the field is not correct. If the field is optional, it
 * will update the value to be undefined if it is not correct.
 *
 * This class can be used to validate nested objects by using a field path
 * (e.g. 'projectAccess.dashboard'). If the field path is invalid, then
 * this class will not report an error, because it is assumed that the
 * parent of the field path will report the error.
 *
 * Document relations are not validated by this class. That is the job of the
 * Document's repository.
 */
export default class Validate {
  parentObject: IndexableObject;

  constructor(
    parentObject: object,
    private errorsArray: string[]
  ) {
    this.parentObject = parentObject as IndexableObject;
  }

  /**
   * Validates if the field is an optional string.
   *
   * @param fieldName - The name of the field to validate.
   */
  optionalString(fieldName: string) {
    if (
      this.fieldPathIsValid(fieldName) &&
      !isOptionalString(this.getField(fieldName))
    ) {
      this.errorsArray.push(`${fieldName} must be a string or undefined`);
      this.deleteField(fieldName);
    }
  }

  /**
   * Validates if the field is an optional number.
   *
   * @param fieldName - The name of the field to validate.
   */
  optionalNumber(fieldName: string) {
    if (
      this.fieldPathIsValid(fieldName) &&
      !isOptionalNumber(this.getField(fieldName))
    ) {
      this.errorsArray.push(`${fieldName} must be a number or undefined`);
      this.deleteField(fieldName);
    }
  }

  /**
   * Validates if the field is an optional boolean.
   *
   * @param fieldName - The name of the field to validate.
   */
  optionalBoolean(fieldName: string) {
    if (
      this.fieldPathIsValid(fieldName) &&
      !isOptionalBoolean(this.getField(fieldName))
    ) {
      this.errorsArray.push(`${fieldName} must be a boolean or undefined`);
      this.deleteField(fieldName);
    }
  }

  /**
   * Validates if the field is an optional array.
   *
   * @param fieldName - The name of the field to validate.
   */
  optionalArray(fieldName: string) {
    if (
      this.fieldPathIsValid(fieldName) &&
      !isOptionalArray(this.getField(fieldName))
    ) {
      this.errorsArray.push(`${fieldName} must be an array or undefined`);
      this.deleteField(fieldName);
    }
  }

  /**
   * Validates if the field is an optional object.
   *
   * @param fieldName - The name of the field to validate.
   */
  optionalObject(fieldName: string) {
    if (
      this.fieldPathIsValid(fieldName) &&
      !isOptionalObject(this.getField(fieldName))
    ) {
      this.errorsArray.push(`${fieldName} must be an object or undefined`);
      this.deleteField(fieldName);
    }
  }

  /**
   * Validates if the field is a string.
   *
   * @param fieldName - The name of the field to validate.
   * @param defaultValue - The default value to set if validation fails.
   */
  string(fieldName: string, defaultValue: string) {
    if (
      this.fieldPathIsValid(fieldName) &&
      typeof this.getField(fieldName) !== 'string'
    ) {
      this.errorsArray.push(`${fieldName} must be a string`);
      this.updateField(fieldName, defaultValue);
    }
  }

  /**
   * Validates if the field is an object.
   *
   * @param fieldName - The name of the field to validate.
   * @param defaultValue - The default value to set if validation fails.
   */
  object(fieldName: string, defaultValue: object) {
    if (
      this.fieldPathIsValid(fieldName) &&
      (Array.isArray(this.getField(fieldName)) ||
        typeof this.getField(fieldName) !== 'object')
    ) {
      this.errorsArray.push(`${fieldName} must be an object`);
      this.updateField(fieldName, defaultValue);
    }
  }

  /**
   * Validates if the field is a number.
   *
   * @param fieldName - The name of the field to validate.
   * @param defaultValue - The default value to set if validation fails.
   */
  number(fieldName: string, defaultValue: number) {
    if (
      this.fieldPathIsValid(fieldName) &&
      typeof this.getField(fieldName) !== 'number'
    ) {
      this.errorsArray.push(`${fieldName} must be a number`);
      this.updateField(fieldName, defaultValue);
    }
  }

  /**
   * Validates if the field is a boolean.
   *
   * @param fieldName - The name of the field to validate.
   * @param defaultValue - The default value to set if validation fails.
   */
  boolean(fieldName: string, defaultValue: boolean) {
    if (
      this.fieldPathIsValid(fieldName) &&
      typeof this.getField(fieldName) !== 'boolean'
    ) {
      this.errorsArray.push(`${fieldName} must be a boolean`);
      this.updateField(fieldName, defaultValue);
    }
  }

  /**
   * Validates if the field is an array.
   *
   * @param fieldName - The name of the field to validate.
   * @param defaultValue - The default value to set if validation fails.
   */
  array(fieldName: string, defaultValue: unknown[]) {
    if (
      this.fieldPathIsValid(fieldName) &&
      !Array.isArray(this.getField(fieldName))
    ) {
      this.errorsArray.push(`${fieldName} must be an array`);
      this.updateField(fieldName, defaultValue);
    }
  }

  /**
   * Checks if the provided field path is valid. In other words, if the
   * field path is of length 1, it always returns true. If the field path
   * is any longer than 1, it will check to make sure the final field is
   * defined in the parent object.
   *
   * The idea is that if the field path is invalid, then this class will
   * not report an error, because it is assumed that the parent of the field
   * path will report the error.
   *
   * @param fieldName - The name of the field to check.
   * @returns boolean - True if the field path is valid, false otherwise.
   */
  private fieldPathIsValid(fieldName: string): boolean {
    const fieldPath = fieldName.split('.');
    if (fieldPath.length === 1) {
      return true;
    }
    let currentObject = this.parentObject;
    for (let i = 0; i < fieldPath.length - 1; i += 1) {
      if (typeof currentObject[fieldPath[i]] !== 'object') {
        return false;
      }
      currentObject = currentObject[fieldPath[i]] as IndexableObject;
    }
    return true;
  }

  /**
   * Updates the field with the provided default value.
   *
   * @param fieldName - The name of the field to update.
   * @param defaultValue - The default value to set.
   */
  private updateField(fieldName: string, defaultValue: unknown) {
    const fieldPath = fieldName.split('.');
    let currentObject = this.parentObject;
    fieldPath.forEach((field, index) => {
      if (index === fieldPath.length - 1) {
        currentObject[field] = defaultValue;
      } else {
        currentObject = currentObject[field] as IndexableObject;
      }
    });
  }

  /**
   * Retrieves the value of the field.
   *
   * @param fieldName - The name of the field to retrieve.
   * @returns unknown - The value of the field.
   */
  private getField(fieldName: string): unknown {
    const fieldPath = fieldName.split('.');
    let currentObject = this.parentObject;
    fieldPath.forEach((field) => {
      currentObject = currentObject[field] as IndexableObject;
    });
    return currentObject;
  }

  /**
   * Deletes the field from the parent object.
   *
   * @param fieldName - The name of the field to delete.
   */
  private deleteField(fieldName: string) {
    const fieldPath = fieldName.split('.');
    let currentObject = this.parentObject;
    fieldPath.forEach((field, index) => {
      if (index === fieldPath.length - 1) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete currentObject[field];
      } else {
        currentObject = currentObject[field] as IndexableObject;
      }
    });
  }
}
