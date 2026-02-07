import APIService from './services/APIService/APIService.js';
import type { APIResponse } from './types/APIResponse.js';
import type { AuthCheckPasswordInput, AuthCheckPasswordOutput } from './types/AuthCheckPassword.js';
import type { AuthValidateUserInput, AuthValidateUserOutput } from './types/AuthValidateUser.js';
import type { DashboardConfig } from './types/project/dashboard/DashboardConfig.js';
import type {
  ProjectDashboardInput,
  ProjectDashboardOptions,
  ProjectDashboardOutput
} from './types/project/dashboard/ProjectDashboard.js';
import type {
  ProjectWorkoutPrimaryEndpointOptions,
  ProjectWorkoutPrimaryInput,
  ProjectWorkoutPrimaryOutput
} from './types/project/workout/ProjectWorkout.js';
import type { Translation, Translations } from './types/Translations.js';
import type {
  DashboardWebSocketClientToServerEvents,
  DashboardWebSocketServerToClientEvents,
  WebSocketHandshakeAuth,
  WorkoutWebSocketClientToServerEvents,
  WorkoutWebSocketServerToClientEvents
} from './types/WebSocket.js';

// Export all browser-safe functions and classes from this library
export { APIService };

// Export TypeScript types where needed
export type {
  APIResponse,
  AuthCheckPasswordInput,
  AuthCheckPasswordOutput,
  AuthValidateUserInput,
  AuthValidateUserOutput,
  DashboardConfig,
  DashboardWebSocketClientToServerEvents,
  DashboardWebSocketServerToClientEvents,
  ProjectDashboardInput,
  ProjectDashboardOptions,
  ProjectDashboardOutput,
  ProjectWorkoutPrimaryEndpointOptions,
  ProjectWorkoutPrimaryInput,
  ProjectWorkoutPrimaryOutput,
  Translation,
  Translations,
  WebSocketHandshakeAuth,
  WorkoutWebSocketClientToServerEvents,
  WorkoutWebSocketServerToClientEvents
};
