import { ObjectId } from 'bson';
import {
  DashboardTaskListGlobalFilterSettings,
  validateFilterSettings
} from '../../embedded-types/dashboard/task/FilterSettings.js';
import {
  DashboardTaskListGlobalSortSettings,
  validateSortSettings
} from '../../embedded-types/dashboard/task/SortSettings.js';
import { DashboardTagSettings } from '../../embedded-types/dashboard/userConfig/Tags.js';
import RequiredUserId from '../../schemas/required-refs/RequiredUserId.js';
import { DocumentValidator } from '../../schemas/validators/DocumentValidator.js';
import Validate from '../../schemas/validators/ValidateUtil.js';
import BaseDocumentWithType from '../BaseDocumentWithType.js';

/**
 * Validates a {@link DashboardUserConfig} object.
 *
 * @param config - The {@link DashboardUserConfig} to validate.
 * @returns An object containing the updated document and any validation errors.
 */
export const validateDashboardUserConfig: DocumentValidator<DashboardUserConfig> = (
  config: DashboardUserConfig
) => {
  const errors: string[] = [];
  const validate = new Validate(config, errors);
  const exampleConfig = new DashboardUserConfig(new ObjectId());

  validate.boolean('enableDevMode', exampleConfig.enableDevMode);
  validate.array('collaborators', exampleConfig.collaborators);
  validate.object('tagSettings', {});
  validate.object('enabledFeatures', exampleConfig.enabledFeatures);
  validate.boolean(
    'enabledFeatures.entertainmentPage',
    exampleConfig.enabledFeatures.entertainmentPage
  );
  validate.boolean(
    'enabledFeatures.catImageOnHomePage',
    exampleConfig.enabledFeatures.catImageOnHomePage
  );
  validate.number('autoTaskDeletionDays', exampleConfig.autoTaskDeletionDays);
  validateSortSettings(validate, config);
  validateFilterSettings(validate, config);

  return { updatedDoc: config, errors };
};

/**
 * Represents the user configuration for the dashboard.
 */
export default class DashboardUserConfig extends BaseDocumentWithType implements RequiredUserId {
  static docType = 'userConfig';

  docType = DashboardUserConfig.docType;

  /**
   * The owner of this config.
   */
  userId: ObjectId;

  /**
   * The different users that the owner of this config is collaborating with
   * on the dashboard.
   */
  collaborators: ObjectId[] = [];

  /**
   * Whether or not to enable dev mode for the user.
   */
  enableDevMode = false;

  /**
   * The features that are enabled for the user.
   */
  enabledFeatures: {
    financePage: boolean;
    automationPage: boolean;
    entertainmentPage: boolean;
    homePageLinks: boolean;
    useConfettiForTasks: boolean;
    catImageOnHomePage: boolean;
  } = {
    financePage: false,
    automationPage: false,
    entertainmentPage: false,
    homePageLinks: false,
    useConfettiForTasks: false,
    catImageOnHomePage: false
  };

  /**
   * The number of days after which a task is automatically deleted. The
   * requirement is that this number is at least 5 days, and at most 90 days.
   *
   * Tasks are only deleted if:
   *
   * - They are not recurring
   * - They are not completed
   * - They have not been updated in the number listed by this setting
   */
  autoTaskDeletionDays: number = 30;

  /**
   * The user's tag settings for the dashboard.
   */
  tagSettings: DashboardTagSettings = {};

  /**
   * The global sort settings for the user's task list.
   */
  taskListSortSettings: DashboardTaskListGlobalSortSettings = {};

  /**
   * The global filter settings for the user's task list.
   */
  taskListFilterSettings: DashboardTaskListGlobalFilterSettings = {};

  /**
   * Creates an instance of {@link DashboardUserConfig}.
   *
   * @param ownerId - The {@link ObjectId} of the owner of this config.
   */
  constructor(ownerId: ObjectId) {
    super();
    this.userId = ownerId;
  }
}
