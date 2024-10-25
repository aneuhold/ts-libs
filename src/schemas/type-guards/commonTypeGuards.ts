/**
 * Checks if the value is either undefined or an object (but not an array).
 *
 * @param value - The value to check.
 * @returns True if the value is undefined or an object, false otherwise.
 */
export function isOptionalObject(value: unknown): value is undefined | object {
  return (
    value === undefined || (typeof value === 'object' && !Array.isArray(value))
  );
}

/**
 * Checks if the value is either undefined, null, or an array.
 *
 * @param value - The value to check.
 * @returns True if the value is undefined, null, or an array, false otherwise.
 */
export function isOptionalArray(
  value: unknown
): value is undefined | Array<unknown> | null {
  return value === undefined || value === null || Array.isArray(value);
}

/**
 * Checks if the value is either undefined, null, or a string.
 *
 * @param value - The value to check.
 * @returns True if the value is undefined, null, or a string, false otherwise.
 */
export function isOptionalString(
  value: unknown
): value is undefined | string | null {
  return value === undefined || value === null || typeof value === 'string';
}

/**
 * Checks if the value is either undefined, null, or a number.
 *
 * @param value - The value to check.
 * @returns True if the value is undefined, null, or a number, false otherwise.
 */
export function isOptionalNumber(
  value: unknown
): value is undefined | null | number {
  return value === undefined || value === null || typeof value === 'number';
}

/**
 * Checks if the value is either undefined, null, or a boolean.
 *
 * @param value - The value to check.
 * @returns True if the value is undefined, null, or a boolean, false otherwise.
 */
export function isOptionalBoolean(
  value: unknown
): value is undefined | null | boolean {
  return value === undefined || value === null || typeof value === 'boolean';
}
