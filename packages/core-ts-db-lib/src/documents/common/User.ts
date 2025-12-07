import { z } from 'zod';
import { BaseDocumentSchema } from '../BaseDocument.js';

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
      googleId: z.string().nullish()
    })
    .default({}),
  projectAccess: z
    .object({
      dashboard: z.boolean().default(true)
    })
    .default({
      dashboard: true
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
