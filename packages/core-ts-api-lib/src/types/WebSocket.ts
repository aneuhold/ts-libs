import type { UUID } from 'crypto';
import type { ProjectDashboardOutput } from './ProjectDashboard.js';

/**
 * The data each client is expected to send over with a request. For example on the client side:
 * 
 * ```
   const socket = io('http://localhost:8080', {
    auth: {
      apiKey: 'your-api-key' // Replace with your actual API key
    }
  });
 * ```
 */
export type WebSocketHandshakeAuth = {
  apiKey?: UUID;
};

/**
 * Nothing for now, except a test event if wanted.
 */
export type DashboardWebSocketClientToServerEvents = {
  test: (data: string) => void;
};

/**
 * The events that the server can send to clients.
 */
export type DashboardWebSocketServerToClientEvents = {
  rootPostResult: (data: ProjectDashboardOutput) => void;
};
