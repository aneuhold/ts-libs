/**
 * Represents a JSON object with a required `version` property.
 * Used as a base interface for package metadata types.
 */
export interface JsonWithVersionProperty {
  version: string;
}

/**
 * Type guard that checks whether an unknown value matches the
 * {@link JsonWithVersionProperty} shape.
 *
 * @param value The value to narrow.
 */
export const isJsonWithVersionProperty = (value: unknown): value is JsonWithVersionProperty =>
  typeof value === 'object' &&
  value !== null &&
  'version' in value &&
  typeof value.version === 'string';
