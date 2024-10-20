/**
 * Some utility functions for handling errors.
 */
export default class ErrorUtils {
  /**
   * Throws an array of errors in a formatted list.
   */
  static throwErrorList(errorList: string[], erroneousObject: object) {
    let errorString = '';
    for (let i = 0; i < errorList.length; i += 1) {
      errorString += `${errorList[i]}\n`;
    }
    throw new Error(
      `${errorString}${JSON.stringify(erroneousObject, null, 2)}`
    );
  }

  /**
   * Throws an error along with an accompanying erroroneous object.
   */
  static throwError(errorMessage: string, erroneousObject: object) {
    ErrorUtils.throwErrorList([errorMessage], erroneousObject);
  }

  /**
   * Gets the error string from an unknown error object.
   */
  static getErrorString(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    } else if (typeof error === 'string') {
      return error;
    } else {
      return JSON.stringify(error);
    }
  }
}
