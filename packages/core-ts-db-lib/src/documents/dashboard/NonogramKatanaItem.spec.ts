import { describe, expect, it } from 'vitest';
import NonogramKatanaItemName from '../../embedded-types/dashboard/nonogramKatanaItem/ItemName.js';
import DocumentService from '../../services/DocumentService.js';
import { NonogramKatanaItemSchema } from './NonogramKatanaItem.js';

describe('Unit Tests', () => {
  describe('NonogramKatanaItemSchema', () => {
    it('should validate a minimal item', () => {
      const userId = DocumentService.generateID();
      const result = NonogramKatanaItemSchema.safeParse({
        userId,
        itemName: NonogramKatanaItemName.Coin
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe(userId);
        expect(result.data._id).toBeDefined();
        expect(result.data.docType).toBe('nonogramKatanaItem');
        expect(result.data.itemName).toBe(NonogramKatanaItemName.Coin);
        expect(result.data.currentAmount).toBe(0);
        expect(result.data.priority).toBe(0);
      }
    });

    it('should validate a complete item with all optional fields', () => {
      const userId = DocumentService.generateID();
      const result = NonogramKatanaItemSchema.safeParse({
        userId,
        itemName: NonogramKatanaItemName.Ruby,
        currentAmount: 50,
        storageCap: 100,
        minDesired: 10,
        maxDesired: 80,
        priority: 5
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currentAmount).toBe(50);
        expect(result.data.storageCap).toBe(100);
        expect(result.data.minDesired).toBe(10);
        expect(result.data.maxDesired).toBe(80);
        expect(result.data.priority).toBe(5);
      }
    });

    it('should fail when itemName is missing', () => {
      const userId = DocumentService.generateID();
      const result = NonogramKatanaItemSchema.safeParse({ userId });
      expect(result.success).toBe(false);
    });
  });
});
