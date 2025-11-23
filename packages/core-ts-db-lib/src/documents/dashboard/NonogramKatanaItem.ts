import type { UUID } from 'crypto';
import NonogramKatanaItemName from '../../embedded-types/dashboard/nonogramKatanaItem/ItemName.js';
import RequiredUserId from '../../schemas/required-refs/RequiredUserId.js';
import type { DocumentValidator } from '../../schemas/validators/DocumentValidator.js';
import BaseDocumentWithType from '../BaseDocumentWithType.js';

/**
 * Validates a {@link NonogramKatanaItem}.
 *
 * @param item - The {@link NonogramKatanaItem} to validate.
 * @returns An object containing the updated document and any validation errors.
 */
export const validateNonogramKatanaItem: DocumentValidator<NonogramKatanaItem> = (
  item: NonogramKatanaItem
) => {
  const errors: string[] = [];

  // No validation at the moment.

  return { updatedDoc: item, errors };
};

/**
 * An item in the Nonogram Katana game.
 */
export default class NonogramKatanaItem extends BaseDocumentWithType implements RequiredUserId {
  static docType = 'nonogramKatanaItem';

  docType = NonogramKatanaItem.docType;

  /**
   * The owner of this Nonogram Katana item.
   */
  userId: UUID;

  itemName: NonogramKatanaItemName;

  currentAmount: number = 0;

  storageCap?: number;

  minDesired?: number;

  maxDesired?: number;

  /**
   * Priority, where the higher the number, the higher up the list it is.
   */
  priority: number = 0;

  constructor(ownerId: UUID, itemName: NonogramKatanaItemName) {
    super();
    this.userId = ownerId;
    this.itemName = itemName;
  }
}
