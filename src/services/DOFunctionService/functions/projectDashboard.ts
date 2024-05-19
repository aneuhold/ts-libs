import { UUID } from 'crypto';
import {
  DashboardTask,
  DashboardUserConfig,
  NonogramKatanaItem,
  NonogramKatanaUpgrade,
  UserCTO
} from '@aneuhold/core-ts-db-lib';
import { Translations } from '../../../types/Translations';
import DOFunction, { DOFunctionInput, DOFunctionOutput } from '../DOFunction';

export interface ProjectDashboardOptions {
  get?: {
    translations?: boolean;
    /**
     * If this is true, the user config will be returned for the user
     * and the collaborators.
     */
    userConfig?: boolean;
    tasks?: boolean;
    userNameIsValid?: string;
    nonogramKatanaItems?: boolean;
    nonogramKatanaUpgrades?: boolean;
  };
  insert?: {
    tasks?: DashboardTask[];
    nonogramKatanaItems?: NonogramKatanaItem[];
    nonogramKatanaUpgrades?: NonogramKatanaUpgrade[];
  };
  update?: {
    userConfig?: DashboardUserConfig;
    tasks?: DashboardTask[];
    nonogramKatanaItems?: NonogramKatanaItem[];
    nonogramKatanaUpgrades?: NonogramKatanaUpgrade[];
  };
  delete?: {
    tasks?: DashboardTask[];
  };
}

export interface ProjectDashboardInput extends DOFunctionInput {
  apiKey: UUID;
  options: ProjectDashboardOptions;
}

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

  static getFunction() {
    if (!this.instance) {
      ProjectDashboard.instance = new ProjectDashboard();
    }
    return ProjectDashboard.instance;
  }
}
