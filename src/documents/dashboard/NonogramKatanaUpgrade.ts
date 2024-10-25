import { ObjectId } from 'bson';
import RequiredUserId from '../../schemas/required-refs/RequiredUserId.js';
import BaseDocumentWithType from '../BaseDocumentWithType.js';
import NonogramKatanaItemName from '../../embedded-types/dashboard/nonogramKatanaItem/ItemName.js';
import NonogramKatanaUpgradeName from '../../embedded-types/dashboard/nonogramKatanaUpgrade/UpgradeName.js';
import { DocumentValidator } from '../../schemas/validators/DocumentValidator.js';

export const validateNonogramKatanaUpgrade: DocumentValidator<
  NonogramKatanaUpgrade
> = (upgrade: NonogramKatanaUpgrade) => {
  const errors: string[] = [];

  // No validation at the moment.

  return { updatedDoc: upgrade, errors };
};

/**
 * An upgrade in the Nonogram Katana game.
 */
export default class NonogramKatanaUpgrade
  extends BaseDocumentWithType
  implements RequiredUserId
{
  static docType = 'nonogramKatanaUpgrade';

  docType = NonogramKatanaUpgrade.docType;

  /**
   * The owner of this Nonogram Katana upgrade.
   */
  userId: ObjectId;

  upgradeName: NonogramKatanaUpgradeName;

  completed: boolean = false;

  currentItemAmounts: { [key in NonogramKatanaItemName]?: number } = {};

  /**
   * Priority, where the higher the number, the higher up the list it is.
   */
  priority: number = 0;

  constructor(ownerId: ObjectId, upgradeName: NonogramKatanaUpgradeName) {
    super();
    this.userId = ownerId;
    this.upgradeName = upgradeName;
  }
}
