/**
 * The filename for the Verdaccio database file.
 */
export const VERDACCIO_DB_FILE_NAME = '.verdaccio-db.json';

/**
 * The type of the Verdaccio database, which is a JSON file
 * containing a list of package names.
 * This is used internally by Verdaccio to track the packages available in
 * the Verdaccio registry.
 */
export type VerdaccioDb = {
  /**
   * The list of package names available in the Verdaccio registry.
   */
  list: string[];
};

/**
 * Type guard that checks whether an unknown value matches the {@link VerdaccioDb} shape.
 *
 * @param value The value to narrow.
 */
export const isVerdaccioDb = (value: unknown): value is VerdaccioDb =>
  typeof value === 'object' &&
  value !== null &&
  'list' in value &&
  Array.isArray(value.list) &&
  value.list.every((item) => typeof item === 'string');
