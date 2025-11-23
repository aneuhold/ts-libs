import { describe, expect, it } from 'vitest';
import DocumentService from './DocumentService.js';

describe('DocumentService', () => {
  describe('deepCopy', () => {
    it('should return a deep copy of the object', () => {
      const obj = {
        id: DocumentService.generateID(),
        a: 1,
        b: {
          c: 2
        }
      };
      const result = DocumentService.deepCopy(obj);
      expect(result).toEqual(obj);
      expect(typeof result.id === 'string').toBeTruthy();
      expect(result.id).toEqual(obj.id);
      expect(result).not.toBe(obj);
      expect(result.b).toEqual(obj.b);
      expect(result.b).not.toBe(obj.b);

      // Change the original object and make sure the copy is not affected
      obj.b.c = 3;
      expect(result.b.c).toEqual(2);
    });
  });
});
