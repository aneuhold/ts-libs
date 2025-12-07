import { describe, expect, it } from 'vitest';
import { ApiKeySchema } from './ApiKey.js';

describe('ApiKeySchema', () => {
  it('should validate a valid API key', () => {
    const userId = '018b2f19-e79e-7d6a-a56d-29feb6211b04';
    const apiKey = { userId };
    const result = ApiKeySchema.safeParse(apiKey);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.userId).toBe(userId);
      expect(result.data._id).toBeDefined();
      expect(result.data.key).toBeDefined();
      expect(typeof result.data.key).toBe('string');
    }
  });

  it('should fail for invalid API key', () => {
    const apiKey = { userId: 'invalid-uuid' }; // Invalid UUID
    const result = ApiKeySchema.safeParse(apiKey);
    expect(result.success).toBe(false);
  });

  it('should generate default key and _id', () => {
    const userId = '018b2f19-e79e-7d6a-a56d-29feb6211b04';
    const result = ApiKeySchema.safeParse({ userId });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.key).toBeDefined();
      expect(result.data._id).toBeDefined();
    }
  });
});
