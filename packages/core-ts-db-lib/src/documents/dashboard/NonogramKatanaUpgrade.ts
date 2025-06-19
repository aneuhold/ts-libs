import { ObjectId } from 'bson';
import NonogramKatanaItemName from '../../embedded-types/dashboard/nonogramKatanaItem/ItemName.js';
import NonogramKatanaUpgradeName from '../../embedded-types/dashboard/nonogramKatanaUpgrade/UpgradeName.js';
import RequiredUserId from '../../schemas/required-refs/RequiredUserId.js';
import { DocumentValidator } from '../../schemas/validators/DocumentValidator.js';
import BaseDocumentWithType from '../BaseDocumentWithType.js';

/**
 * Validates a {@link NonogramKatanaUpgrade} document.
 *
 * @param upgrade The {@link NonogramKatanaUpgrade} document to validate.
 * @returns An object containing the updated document and any validation errors.
 */
export const validateNonogramKatanaUpgrade: DocumentValidator<NonogramKatanaUpgrade> = (
  upgrade: NonogramKatanaUpgrade
) => {
  const errors: string[] = [];

  // No validation at the moment.

  return { updatedDoc: upgrade, errors };
};

/**
 * Represents an upgrade for a Nonogram Katana.
 *
 * @example
 * ```typescript
 * const upgrade = new NonogramKatanaUpgrade(ownerId, upgradeName);
 * upgrade.completed = true;
 * upgrade.priority = 5;
 * ```
 */
export default class NonogramKatanaUpgrade extends BaseDocumentWithType implements RequiredUserId {
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

  /**
   * Creates an instance of NonogramKatanaUpgrade.
   *
   * @param ownerId - The ID of the owner of this upgrade.
   * @param upgradeName - The name of the upgrade.
   */
  constructor(ownerId: ObjectId, upgradeName: NonogramKatanaUpgradeName) {
    super();
    this.userId = ownerId;
    this.upgradeName = upgradeName;
  }
}
