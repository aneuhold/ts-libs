import { ObjectId } from 'bson';
import BaseDocumentWithType from '../BaseDocumentWithType';
import RequiredUserId from '../../schemas/required_refs/RequiredUserId';

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
