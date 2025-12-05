import type { UserCTO } from '@aneuhold/core-ts-db-lib';
import {
  DashboardTask,
  DashboardUserConfig,
  NonogramKatanaItem,
  NonogramKatanaUpgrade
} from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { Translations } from './Translations.js';

/**
 * Options for configuring the project dashboard.
 */
export interface ProjectDashboardOptions {
  get?: {
    /**
     * Whether to include translations in the response.
     */
    translations?: boolean;
    /**
     * If true, the user config will be returned for the user
     * and the collaborators.
     */
    userConfig?: boolean;
    /**
     * Whether to include tasks in the response.
     */
    tasks?: boolean;
    /**
     * A string indicating if the user name is valid.
     */
    userNameIsValid?: string;
    /**
     * Whether to include nonogram katana items in the response.
     */
    nonogramKatanaItems?: boolean;
    /**
     * Whether to include nonogram katana upgrades in the response.
     */
    nonogramKatanaUpgrades?: boolean;
  };
  insert?: {
    /**
     * Tasks to be inserted.
     */
    tasks?: DashboardTask[];
    /**
     * Nonogram katana items to be inserted.
     */
    nonogramKatanaItems?: NonogramKatanaItem[];
    /**
     * Nonogram katana upgrades to be inserted.
     */
    nonogramKatanaUpgrades?: NonogramKatanaUpgrade[];
  };
  update?: {
    /**
     * User configuration to be updated.
     */
    userConfig?: DashboardUserConfig;
    /**
     * Tasks to be updated.
     */
    tasks?: DashboardTask[];
    /**
     * Nonogram katana items to be updated.
     */
    nonogramKatanaItems?: NonogramKatanaItem[];
    /**
     * Nonogram katana upgrades to be updated.
     */
    nonogramKatanaUpgrades?: NonogramKatanaUpgrade[];
  };
  delete?: {
    /**
     * Tasks to be deleted.
     */
    tasks?: DashboardTask[];
  };
}

/**
 * Represents the input to the project dashboard function.
 */
export interface ProjectDashboardInput {
  apiKey: UUID;
  options: ProjectDashboardOptions;
}

/**
 * Represents the output of the project dashboard function.
 */
export interface ProjectDashboardOutput {
  translations?: Translations;
  userConfig?: DashboardUserConfig;
  tasks?: DashboardTask[];
  collaborators?: UserCTO[];
  userFromUserName?: UserCTO | null;
  nonogramKatanaItems?: NonogramKatanaItem[];
  nonogramKatanaUpgrades?: NonogramKatanaUpgrade[];
}
