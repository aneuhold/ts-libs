import { ObjectId } from 'bson';
import RequiredUserId from '../../schemas/required-refs/RequiredUserId';
import BaseDocumentWithType from '../BaseDocumentWithType';
import NonogramKatanaItemName from '../../embedded-types/dashboard/nonogramKatanaItem/ItemName';
import { DocumentValidator } from '../../schemas/validators/DocumentValidator';

export const validateNonogramKatanaItem: DocumentValidator<
  NonogramKatanaItem
> = (item: NonogramKatanaItem) => {
  const errors: string[] = [];

  // No validation at the moment.

  return { updatedDoc: item, errors };
};

/**
 * An item in the Nonogram Katana game.
 */
export default class NonogramKatanaItem
  extends BaseDocumentWithType
  implements RequiredUserId
{
  static docType = 'nonogramKatanaItem';

  docType = NonogramKatanaItem.docType;

  /**
   * The owner of this Nonogram Katana item.
   */
  userId: ObjectId;

  itemName: NonogramKatanaItemName;

  currentAmount: number = 0;

  storageCap?: number;

  minDesired?: number;

  maxDesired?: number;

  /**
   * Priority, where the higher the number, the higher up the list it is.
   */
  priority: number = 0;

  constructor(ownerId: ObjectId, itemName: NonogramKatanaItemName) {
    super();
    this.userId = ownerId;
    this.itemName = itemName;
  }
}
