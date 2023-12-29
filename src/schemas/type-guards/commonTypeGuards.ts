export function isOptionalObject(value: unknown): value is undefined | object {
  return value === undefined || typeof value === 'object';
}

export function isOptionalArray(
  value: unknown
): value is undefined | Array<unknown> {
  return value === undefined || Array.isArray(value);
}

export function isOptionalString(value: unknown): value is undefined | string {
  return value === undefined || typeof value === 'string';
}

export function isOptionalNumber(value: unknown): value is undefined | number {
  return value === undefined || typeof value === 'number';
}

export function isOptionalBoolean(
  value: unknown
): value is undefined | boolean {
  return value === undefined || typeof value === 'boolean';
}
