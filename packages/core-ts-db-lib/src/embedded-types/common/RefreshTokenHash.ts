import { z } from 'zod';

/**
 * Schema for an individual hashed refresh token stored on a user.
 */
export const RefreshTokenHashSchema = z.object({
  /** SHA-256 hash of the refresh token (never store the raw token). */
  tokenHash: z.string(),
  /** When this refresh token expires. */
  expiresAt: z.date()
});

/** A single hashed refresh token entry stored within {@link User.auth}. */
export type RefreshTokenHash = z.infer<typeof RefreshTokenHashSchema>;
