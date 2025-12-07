import { randomUUID } from 'crypto';
import { z } from 'zod';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';

/**
 * The schema for {@link ApiKey} documents.
 */
export const ApiKeySchema = RequiredUserIdSchema.extend({
  key: z
    .uuid()
    .default(() => randomUUID())
    .describe('The API key for the user. This is indexed in the DB.')
});

/**
 * A document containing an API key for a particular user. This is stored
 * separately from the {@link User} document to enhance security a bit.
 */
export type ApiKey = z.infer<typeof ApiKeySchema>;
