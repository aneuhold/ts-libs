import { ObjectId } from 'bson';
import BaseDocumentWithType from '../BaseDocumentWithType';
import BaseDocumentWithUserId from '../BaseDocumentWithUserId';

export default class DashboardUserConfig
  extends BaseDocumentWithType
  implements BaseDocumentWithUserId
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
