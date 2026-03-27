import type { DashboardUserConfig, User } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';

/**
 * Input for admin API calls. Contains CRUD operations for managing
 * entities as a super admin.
 */
export interface AdminInput {
  get?: {
    /** Fetch all users (list view). */
    users?: boolean;
    /** Fetch detailed info for a single user by ID (user detail page). */
    userDetail?: UUID;
  };
  insert?: {
    /** New users to create. Use `UserSchema.parse()` on the frontend. */
    users?: User[];
  };
  update?: {
    /** Full user documents to update. */
    users?: User[];
  };
  delete?: {
    /** User IDs to delete. */
    userIds?: UUID[];
  };
}

/**
 * Output from admin API calls.
 */
export interface AdminOutput {
  /** All users (from get.users). */
  users?: User[];
  /** Detailed info for a single user (from get.userDetail). */
  userDetail?: AdminOutputUserDetail;
}

/**
 * Detailed information about a single user, including their dashboard
 * configuration and document counts.
 */
export interface AdminOutputUserDetail {
  user: User;
  userConfig?: DashboardUserConfig;
  documentCounts?: AdminOutputUserDocumentCounts;
}

/**
 * Counts of documents owned by a user across all collections.
 */
export interface AdminOutputUserDocumentCounts {
  tasks: number;
  nonogramKatanaItems: number;
  nonogramKatanaUpgrades: number;
  workoutExercises: number;
  workoutEquipmentTypes: number;
  workoutMuscleGroups: number;
  workoutMesocycles: number;
  workoutMicrocycles: number;
  workoutSessions: number;
  workoutSessionExercises: number;
  workoutSets: number;
  workoutExerciseCalibrations: number;
}
