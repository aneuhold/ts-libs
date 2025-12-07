import { z } from 'zod';
import NonogramKatanaUpgradeName from '../../embedded-types/dashboard/nonogramKatanaUpgrade/UpgradeName.js';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import { BaseDocumentWithTypeSchema } from '../BaseDocument.js';

/**
 * The schema for {@link NonogramKatanaUpgrade} documents.
 */
export const NonogramKatanaUpgradeSchema = z.object({
  ...BaseDocumentWithTypeSchema.shape,
  ...RequiredUserIdSchema.shape,
  docType: z.literal('nonogramKatanaUpgrade').default('nonogramKatanaUpgrade'),
  upgradeName: z.enum(NonogramKatanaUpgradeName),
  completed: z.boolean().default(false),
  currentItemAmounts: z.record(z.string(), z.int().optional()).default({}),
  /**
   * Priority, where the higher the number, the higher up the list it is.
   */
  priority: z.int().default(0)
});

/**
 * Represents an upgrade for a Nonogram Katana.
 */
export type NonogramKatanaUpgrade = z.infer<typeof NonogramKatanaUpgradeSchema>;
