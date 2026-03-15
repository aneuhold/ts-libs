import type { ApiKey, User } from '@aneuhold/core-ts-db-lib';
import { GOOGLE_CLIENT_ID, UserSchema } from '@aneuhold/core-ts-db-lib';
import { OAuth2Client } from 'google-auth-library';
import ApiKeyRepository from '../repositories/common/ApiKeyRepository.js';
import UserRepository from '../repositories/common/UserRepository.js';

/**
 * Service for verifying Google ID tokens and finding or creating users.
 * Handles account linking by email when a matching user exists without a
 * Google ID.
 */
export default class GoogleAuthService {
  private static readonly client = new OAuth2Client(GOOGLE_CLIENT_ID);

  /**
   * Verifies a Google ID token and finds or creates the associated user.
   *
   * @param googleCredentialToken - The Google ID token string from the client.
   */
  static async verifyAndFindOrCreateUser(
    googleCredentialToken: string
  ): Promise<{ user: User; apiKey: ApiKey }> {
    const ticket = await this.client.verifyIdToken({
      idToken: googleCredentialToken,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid Google token payload');
    }

    const { sub: googleId, email } = payload;
    if (!email) {
      throw new Error('Google account has no email');
    }

    const userRepo = UserRepository.getRepo();
    const apiKeyRepo = ApiKeyRepository.getRepo();

    // 1. Look up by googleId
    let user = await userRepo.get({ auth: { googleId } });

    // 2. Fall back to email lookup (account linking)
    if (!user) {
      user = await userRepo.get({ email });
      if (user) {
        // Link Google ID to existing account
        await userRepo.update({ _id: user._id, auth: { ...user.auth, googleId } });
        user.auth.googleId = googleId;
      }
    }

    // 3. Create new user if neither match. The ApiKey subscriber on
    //    UserRepository automatically creates an API key on user insertion.
    if (!user) {
      const newUser = UserSchema.parse({
        userName: email,
        email,
        auth: { googleId },
        projectAccess: { dashboard: false, workout: true }
      });
      const insertedUser = await userRepo.insertNew(newUser);
      if (!insertedUser) {
        throw new Error('Failed to create user');
      }
      user = insertedUser;
    }

    const apiKey = await apiKeyRepo.get({ userId: user._id });
    if (!apiKey) {
      throw new Error(`No API key found for user ${user._id}`);
    }

    return { user, apiKey };
  }
}
