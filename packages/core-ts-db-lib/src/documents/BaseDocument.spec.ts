import { describe, expect, it } from 'vitest';
import { BaseDocumentSchema } from './BaseDocument.js';

describe('BaseDocumentSchema', () => {
  it('should generate a default _id', () => {
    const result = BaseDocumentSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data._id).toBeDefined();
      expect(typeof result.data._id).toBe('string');
    }
  });

  it('should accept a valid UUID string', () => {
    const uuid = '018b2f19-e79e-7d6a-a56d-29feb6211b04';
    const result = BaseDocumentSchema.safeParse({ _id: uuid });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data._id).toBe(uuid);
    }
  });
});
