import { describe, expect, it } from 'vitest';
import { UserSchema } from './User.js';

describe('UserSchema', () => {
  it('should validate a valid user', () => {
    const user = { userName: 'testuser' };
    const result = UserSchema.safeParse(user);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.userName).toBe('testuser');
      expect(result.data._id).toBeDefined();
      expect(result.data.projectAccess.dashboard).toBe(false);
    }
  });

  it('should fail for invalid user', () => {
    const user = { userName: 123 }; // Invalid type
    const result = UserSchema.safeParse(user);
    expect(result.success).toBe(false);
  });
});
