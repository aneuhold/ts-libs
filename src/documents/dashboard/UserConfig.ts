import { ObjectId } from 'bson';
import BaseDocumentWithType from '../BaseDocumentWithType';
import RequiredUserId from '../../schemas/required-refs/RequiredUserId';
import Validate from '../../schemas/validators/ValidateUtil';

export const validateDashboardUserConfig = (config: DashboardUserConfig) => {
  const errors: string[] = [];
  const validate = new Validate(config, errors);
  const exampleConfig = new DashboardUserConfig(new ObjectId());

  validate.boolean('enableDevMode', exampleConfig.enableDevMode);

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
   * Whether or not to enable dev mode for the user.
   */
  enableDevMode = false;

  constructor(ownerId: ObjectId) {
    super();
    this.userId = ownerId;
  }
}
