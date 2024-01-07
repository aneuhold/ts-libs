import { ObjectId } from 'bson';
import BaseDocumentWithType from '../BaseDocumentWithType';
import RequiredUserId from '../../schemas/required-refs/RequiredUserId';
import Validate from '../../schemas/validators/ValidateUtil';
import { DocumentValidator } from '../../schemas/validators/DocumentValidator';

export const validateDashboardUserConfig: DocumentValidator<
  DashboardUserConfig
> = (config: DashboardUserConfig) => {
  const errors: string[] = [];
  const validate = new Validate(config, errors);
  const exampleConfig = new DashboardUserConfig(new ObjectId());

  validate.boolean('enableDevMode', exampleConfig.enableDevMode);
  validate.array('collaborators', exampleConfig.collaborators);

  return { updatedDoc: config, errors };
};

export default class DashboardUserConfig
  extends BaseDocumentWithType
  implements RequiredUserId
{
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

  constructor(ownerId: ObjectId) {
    super();
    this.userId = ownerId;
  }
}
