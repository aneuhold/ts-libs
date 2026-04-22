/**
 * Recursively makes all properties of `T` optional. Unlike `Partial<T>` which
 * only applies to the top level, this applies to all nested objects as well.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Record<PropertyKey, unknown> ? DeepPartial<T[P]> : T[P];
};
