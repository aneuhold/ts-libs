export function isOptionalObject(value: unknown): value is undefined | object {
  return value === undefined || typeof value === 'object';
}

export function isOptionalArray(
  value: unknown
): value is undefined | Array<unknown> | null {
  return value === undefined || value === null || Array.isArray(value);
}

export function isOptionalString(
  value: unknown
): value is undefined | string | null {
  return value === undefined || value === null || typeof value === 'string';
}

export function isOptionalNumber(
  value: unknown
): value is undefined | null | number {
  return value === undefined || value === null || typeof value === 'number';
}

export function isOptionalBoolean(
  value: unknown
): value is undefined | null | boolean {
  return value === undefined || value === null || typeof value === 'boolean';
}
