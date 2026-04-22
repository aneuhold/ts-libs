import { z } from 'zod';

/**
 * Zod schema for the environment configuration pulled in for the current
 * environment from the GitHub repository.
 */
export const ConfigSchema = z.object({
  someKey: z.string(),
  mongoRootUsername: z.string(),
  mongoRootPassword: z.string(),
  mongoUrl: z.string(),
  /** Secret used to sign JWT access tokens. */
  jwtAccessSecret: z.string(),
  /** Test user credentials for e2e tests. */
  testUserInfo: z.object({
    userName: z.string(),
    password: z.string()
  })
});

/**
 * The environment configuration that is pulled in for the current environment
 * from the GitHub repository.
 */
type Config = z.infer<typeof ConfigSchema>;

export type { Config as default };
