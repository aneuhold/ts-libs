import {
  DashboardTask,
  DashboardUserConfig,
  NonogramKatanaItem,
  NonogramKatanaUpgrade,
  UserCTO
} from '@aneuhold/core-ts-db-lib';
import { UUID } from 'crypto';
import { Translations } from '../../../types/Translations.js';
import DOFunction, {
  DOFunctionInput,
  DOFunctionOutput
} from '../DOFunction.js';

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
export interface ProjectDashboardInput extends DOFunctionInput {
  apiKey: UUID;
  options: ProjectDashboardOptions;
}

/**
 * Represents the output of the project dashboard function.
 */
export interface ProjectDashboardOutput extends DOFunctionOutput {
  translations?: Translations;
  userConfig?: DashboardUserConfig;
  tasks?: DashboardTask[];
  collaborators?: UserCTO[];
  userFromUserName?: UserCTO | null;
  nonogramKatanaItems?: NonogramKatanaItem[];
  nonogramKatanaUpgrades?: NonogramKatanaUpgrade[];
}

/**
 * The Digital Ocean function which handles all data requests for the
 * dashboard project.
 */
export default class ProjectDashboard extends DOFunction<
  ProjectDashboardInput,
  ProjectDashboardOutput
> {
  private static instance: ProjectDashboard | undefined;

  private constructor() {
    super();
  }

  static getFunction(): ProjectDashboard {
    if (!ProjectDashboard.instance) {
      ProjectDashboard.instance = new ProjectDashboard();
    }
    return ProjectDashboard.instance;
  }
}
