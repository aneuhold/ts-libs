import { ObjectId } from 'bson';
import DocumentService from './DocumentService';

describe('DocumentService', () => {
  describe('deepCopy', () => {
    it('should return a deep copy of the object', () => {
      const obj = {
        id: new ObjectId(),
        a: 1,
        b: {
          c: 2
        }
      };
      const result = DocumentService.deepCopy(obj);
      expect(result).toEqual(obj);
      expect(typeof result.id === 'object').toBeTruthy();
      expect(result.id.toString()).toEqual(obj.id.toString());
      expect(result).not.toBe(obj);
      expect(result.b).toEqual(obj.b);
      expect(result.b).not.toBe(obj.b);

      // Change the original object and make sure the copy is not affected
      obj.b.c = 3;
      expect(result.b.c).toEqual(2);
    });
  });
});
