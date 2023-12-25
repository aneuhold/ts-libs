import { UUID } from 'crypto';
import { DashboardUserConfig } from '@aneuhold/core-ts-db-lib';
import { Translations } from '../../../types/Translations';
import DOFunction, { DOFunctionInput, DOFunctionOutput } from '../DOFunction';

export interface ProjectDashboardOptions {
  get?: {
    translations?: boolean;
    userConfig?: boolean;
  };
  update?: {
    userConfig?: DashboardUserConfig;
  };
  delete?: {
    placeholder?: boolean;
  };
}

export interface ProjectDashboardInput extends DOFunctionInput {
  apiKey: UUID;
  options: ProjectDashboardOptions;
}

export interface ProjectDashboardOutput extends DOFunctionOutput {
  success: boolean;
  data?: {
    translations?: Translations;
    userConfig?: DashboardUserConfig;
  };
}

/**
 * The Digital Ocean function which handles all data requests for the
 * dashboard project.
 */
export default class ProjectDashboard extends DOFunction<
  ProjectDashboardInput,
  ProjectDashboardOutput
> {
  private static instance: ProjectDashboard;

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
