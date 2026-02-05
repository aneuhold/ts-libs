import { z } from 'zod';
import NonogramKatanaItemName from '../../embedded-types/dashboard/nonogramKatanaItem/ItemName.js';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import { BaseDocumentWithTypeSchema } from '../BaseDocument.js';

/**
 * The docType value for NonogramKatanaItem documents.
 */
export const NonogramKatanaItem_docType = 'nonogramKatanaItem';

/**
 * The schema for {@link NonogramKatanaItem} documents.
 */
export const NonogramKatanaItemSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  docType: z.literal(NonogramKatanaItem_docType).default(NonogramKatanaItem_docType),
  itemName: z.enum(NonogramKatanaItemName),
  currentAmount: z.int().default(0),
  storageCap: z.int().nullish(),
  minDesired: z.int().nullish(),
  maxDesired: z.int().nullish(),
  /**
   * Priority, where the higher the number, the higher up the list it is.
   */
  priority: z.number().default(0)
});

/**
 * An item in the Nonogram Katana game.
 */
export type NonogramKatanaItem = z.infer<typeof NonogramKatanaItemSchema>;
