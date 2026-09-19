import type { AdminInput, AdminOutput } from '../../types/Admin.js';
import type { APIResponse } from '../../types/APIResponse.js';
import type { AuthDeleteAccountOutput } from '../../types/AuthDeleteAccount.js';
import type {
  OnAuthExpiredCallback,
  OnTokensRefreshedCallback
} from '../../types/AuthRefreshToken.js';
import type {
  AuthValidateUserInput,
  AuthValidateUserOutput
} from '../../types/AuthValidateUser.js';
import type {
  ProjectDashboardInput,
  ProjectDashboardOutput
} from '../../types/project/dashboard/ProjectDashboard.js';
import type {
  ProjectWorkoutPrimaryInput,
  ProjectWorkoutPrimaryOutput
} from '../../types/project/workout/ProjectWorkout.js';

/**
 * The backend that `APIService` delegates every call to. The default is
 * the Google Cloud API, and an alternative (for example, one that answers
 * without a network) can be installed with `APIService.setBackend`.
 */
export interface IAPIBackend {
  /**
   * The base URL the backend uses when none has been set.
   */
  readonly defaultUrl: string;

  authValidateUser(input: AuthValidateUserInput): Promise<APIResponse<AuthValidateUserOutput>>;
  authLogout(): Promise<APIResponse<undefined>>;
  authDeleteAccount(): Promise<APIResponse<AuthDeleteAccountOutput>>;
  projectDashboard(input: ProjectDashboardInput): Promise<APIResponse<ProjectDashboardOutput>>;
  admin(input: AdminInput): Promise<APIResponse<AdminOutput>>;
  projectWorkout(
    input: ProjectWorkoutPrimaryInput
  ): Promise<APIResponse<ProjectWorkoutPrimaryOutput>>;
  setAccessToken(token: string): void;
  setRefreshTokenString(token: string): void;
  setOnTokensRefreshed(callback: OnTokensRefreshedCallback | null): void;
  setOnAuthExpired(callback: OnAuthExpiredCallback | null): void;
  getUrl(): string;
  setUrl(url: string): void;
}
