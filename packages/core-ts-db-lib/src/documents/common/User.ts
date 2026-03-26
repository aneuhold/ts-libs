import { z } from 'zod';
import { BaseDocumentSchema } from '../BaseDocument.js';
import ProjectName from '../../embedded-types/common/ProjectName.js';
import { RefreshTokenHashSchema } from '../../embedded-types/common/RefreshTokenHash.js';

/**
 * The schema for {@link UserCTO} documents. This also acts a base for the {@link UserSchema}.
 */
export const UserCTOSchema = BaseDocumentSchema.extend({
  userName: z.string()
});

/**
 * The schema for {@link User} documents.
 */
export const UserSchema = UserCTOSchema.extend({
  email: z.email().nullish(),
  auth: z
    .object({
      password: z.string().nullish(),
      googleId: z.string().nullish(),
      /** Whether this user is a super admin with access to admin endpoints. */
      isSuperAdmin: z.boolean().nullish(),
      /** Active refresh token hashes. One per device/session. */
      refreshTokenHashes: z.array(RefreshTokenHashSchema).default([])
    })
    .default({ refreshTokenHashes: [] }),
  projectAccess: z
    .object({
      [ProjectName.Dashboard]: z.boolean().default(false),
      [ProjectName.Workout]: z.boolean().default(true)
    })
    .default({
      [ProjectName.Dashboard]: false,
      [ProjectName.Workout]: true
    })
});

/**
 * A standard user of all personal projects. This should be linked to from
 * other documents that need to reference a user, instead of cluttering the
 * key user information.
 */
export type User = z.infer<typeof UserSchema>;

/**
 * A User CTO which can be used to reference a User with only the necessary
 * information.
 */
export type UserCTO = z.infer<typeof UserCTOSchema>;
