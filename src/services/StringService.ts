/**
 * A service which can be used to interact with strings.
 */
export default class StringService {
  /**
   * Gets the file extension of the provided file name.
   *
   * @param fileName the full name of the file or the entire file path
   * @returns a string containing the extension of the file name or undefined
   * if there is no extension
   */
  static getFileNameExtension(fileName: string): string | undefined {
    return fileName.split('.').pop();
  }

  /**
   * Strips JSON comments from the provided JSON string. Only `//` comments
   * are supported at the moment.
   */
  static stripJsonComments = (jsonString: string) => {
    const commentRegex = /\/\/(.*)/g;
    return jsonString.replace(commentRegex, '');
  };
}
