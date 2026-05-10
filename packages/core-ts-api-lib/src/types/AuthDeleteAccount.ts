/**
 * Input type for the auth deleteAccount endpoint. The endpoint is
 * authenticated via the bearer token, so no payload is required today —
 * the dedicated alias makes future fields easy to add (e.g. confirmation
 * token).
 */
export type AuthDeleteAccountInput = undefined;

/**
 * Output type for the auth deleteAccount endpoint.
 */
export type AuthDeleteAccountOutput = Record<string, never>;
