import { z } from 'zod';
import { NonogramKatanaItemNameSchema } from '../../embedded-types/dashboard/nonogramKatanaItem/ItemName.js';
import NonogramKatanaUpgradeName from '../../embedded-types/dashboard/nonogramKatanaUpgrade/UpgradeName.js';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import { BaseDocumentWithTypeSchema } from '../BaseDocument.js';

/**
 * The docType value for NonogramKatanaUpgrade documents.
 */
export const NonogramKatanaUpgrade_docType = 'nonogramKatanaUpgrade';

/**
 * The schema for {@link NonogramKatanaUpgrade} documents.
 */
export const NonogramKatanaUpgradeSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  docType: z.literal(NonogramKatanaUpgrade_docType).default(NonogramKatanaUpgrade_docType),
  upgradeName: z.enum(NonogramKatanaUpgradeName),
  completed: z.boolean().default(false),
  currentItemAmounts: z.partialRecord(NonogramKatanaItemNameSchema, z.int().nullish()).default({}),
  /**
   * Priority, where the higher the number, the higher up the list it is.
   */
  priority: z.number().default(0)
});

/**
 * Represents an upgrade for a Nonogram Katana.
 */
export type NonogramKatanaUpgrade = z.infer<typeof NonogramKatanaUpgradeSchema>;
